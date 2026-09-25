# Catálogo: lee la planilla (CSV publicado), normaliza los productos y prepara las fotos en WebP.
# Lo usa armar.py. Solo `actualizar()` necesita internet (planilla + fotos de Google Drive) y Pillow.
#
# Archivos que mantiene:
#   web/datos/catalogo.json          productos listos para el sitio (lo lee web/js/rinbo.js)
#   web/fotos/<id>/<huella>-600.webp  foto chica (tarjetas)   · <huella>-1200.webp foto grande (ficha)
#   web/fotos/<id>/og-<huella>.jpg    primera foto en JPG (WhatsApp, Google Merchant)
#   web-plantillas/estado-catalogo.json   memoria del robot: fotos ya convertidas, fechas de cambio y direcciones antiguas
import csv
import datetime
import hashlib
import io
import json
import pathlib
import re
import sys
import unicodedata
import urllib.request

AQUI = pathlib.Path(__file__).parent
WEB = AQUI.parent / 'web'
JSON_CATALOGO = WEB / 'datos' / 'catalogo.json'
ESTADO = AQUI / 'estado-catalogo.json'
FOTOS = WEB / 'fotos'
TAM_CHICA, TAM_GRANDE = 600, 1200


def slug(s):
    s = unicodedata.normalize('NFD', str(s).lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def config_js(clave):
    """Lee un valor de texto del bloque CONFIG de web/js/rinbo.js (único lugar donde se configura)."""
    js = (WEB / 'js' / 'rinbo.js').read_text(encoding='utf-8')
    m = re.search(clave + r'\s*:\s*"([^"]*)"', js)
    return m.group(1) if m else ''


def numero(s):
    d = re.sub(r'\D', '', str(s or ''))
    return int(d) if d else 0


def opcion(s):
    s = str(s or '')
    i = s.find(':')
    if i < 0:
        return None
    valores = [v.strip() for v in s[i + 1:].split('|') if v.strip()]
    return {'nombre': s[:i].strip(), 'valores': valores} if valores else None


def usado(p):
    return bool(re.search(r'usado|semi', p['estado'], re.I))


def vendido(p):
    return p['stock'].strip().lower() == 'vendido'


def en_oferta(p):
    return p['precio'] > 0 and 0 < p['oferta'] < p['precio']


def precio_activo(p):
    return p['oferta'] if en_oferta(p) else p['precio']


def leer_csv(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (rinbo.store robot)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        texto = r.read().decode('utf-8-sig')
    filas = list(csv.reader(io.StringIO(texto)))
    cab = [c.strip().lower() for c in filas[0]]
    return [{h: (f[i] if i < len(f) else '').strip() for i, h in enumerate(cab)} for f in filas[1:]]


def normalizar(r):
    return {
        'id': r['id'], 'nombre': r['nombre'], 'cat': r.get('categoria_principal', ''), 'sub': r.get('categoria_secundaria', ''),
        'detalle': r.get('detalle', ''), 'ops': [o for o in (opcion(r.get('opcion_1')), opcion(r.get('opcion_2'))) if o],
        'desc': r.get('descripcion', ''), 'estado': r.get('estado', ''), 'precio': numero(r.get('precio_clp')),
        'oferta': numero(r.get('precio_oferta')), 'stock': r.get('stock', ''),
        'destacado': r.get('destacado', '').upper() == 'SI', 'tabla': r.get('tabla_tallas', ''), 'pie': r.get('detalle_pie', ''),
        'ig': r.get('instagram', '') if re.match(r'https?://', r.get('instagram', '')) else '',
        'marca': r.get('marca', ''),
        'fotos_origen': [r.get(f'foto_{i}', '') for i in range(1, 13) if r.get(f'foto_{i}', '')],
    }


def url_descarga(u):
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', u) or re.search(r'[?&]id=([a-zA-Z0-9_-]+)', u)
    if m and 'google.' in u:
        return f'https://drive.google.com/thumbnail?id={m.group(1)}&sz=w1600'
    return u


def huella_texto(s):
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:10]


def convertir_foto(origen, carpeta, es_primera, estado_fotos):
    """Descarga una foto y la guarda en WebP (600 y 1200 de ancho). Devuelve {m, g, w, h} o None si falla."""
    from PIL import Image  # solo se necesita al actualizar
    h = huella_texto(origen)
    chica, grande, og = carpeta / f'{h}-{TAM_CHICA}.webp', carpeta / f'{h}-{TAM_GRANDE}.webp', carpeta / f'og-{h}.jpg'
    clave = f'{carpeta.name}|{origen}'
    previo = estado_fotos.get(clave)
    if previo and chica.exists() and grande.exists() and (not es_primera or og.exists()):
        return previo
    try:
        req = urllib.request.Request(url_descarga(origen), headers={'User-Agent': 'Mozilla/5.0 (rinbo.store robot)'})
        with urllib.request.urlopen(req, timeout=60) as r:
            datos = r.read()
        im = Image.open(io.BytesIO(datos))
        im.load()
    except Exception as e:  # foto borrada, sin permiso, etc.: el sitio usa el link original
        print(f'  ! foto no disponible ({e}): {origen}', file=sys.stderr)
        return None
    carpeta.mkdir(parents=True, exist_ok=True)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    res = {}
    for ancho, destino in ((TAM_CHICA, chica), (TAM_GRANDE, grande)):
        copia = im.copy()
        if copia.width > ancho:
            copia = copia.resize((ancho, round(copia.height * ancho / copia.width)), Image.LANCZOS)
        copia.save(destino, 'WEBP', quality=80, method=6)
        if ancho == TAM_GRANDE:
            res['w'], res['h'] = copia.width, copia.height
    if es_primera:
        fondo = Image.new('RGB', im.size, 'white')
        fondo.paste(im, mask=im.split()[-1] if im.mode == 'RGBA' else None)
        if fondo.width > TAM_GRANDE:
            fondo = fondo.resize((TAM_GRANDE, round(fondo.height * TAM_GRANDE / fondo.width)), Image.LANCZOS)
        fondo.save(og, 'JPEG', quality=82, optimize=True, progressive=True)
    base = f'/fotos/{carpeta.name}/'
    res.update({'m': base + chica.name, 'g': base + grande.name, 'og': base + og.name if es_primera else ''})
    estado_fotos[clave] = res
    return res


def leer_estado():
    if ESTADO.exists():
        return json.loads(ESTADO.read_text(encoding='utf-8'))
    return {'fotos': {}, 'productos': {}, 'slugs_antiguos': {}}


def asignar_slugs(productos, estado):
    usados = set()
    for p in productos:
        base = slug(p['nombre']) or slug(p['id'])
        s = base if base not in usados else f"{base}-{slug(p['id'])}"
        usados.add(s)
        p['slug'] = s
        previo = estado['productos'].get(p['id'], {}).get('slug')
        if previo and previo != s:  # cambió el nombre: la dirección antigua redirige a la nueva
            estado['slugs_antiguos'][previo] = p['id']
    for s in list(estado['slugs_antiguos']):
        if s in usados:
            del estado['slugs_antiguos'][s]


def actualizar():
    """Descarga la planilla y las fotos y reescribe web/datos/catalogo.json. Devuelve la lista de productos."""
    url = config_js('sheetCsvUrl')
    filas = leer_csv(url)
    productos = [normalizar(r) for r in filas if r.get('id') and r.get('nombre') and r.get('publicado', '').upper() == 'SI']
    if not productos:
        raise RuntimeError('La planilla no devolvió productos publicados (¿error de Google?). No se cambia nada.')
    ids = [p['id'] for p in productos]
    if len(ids) != len(set(ids)):
        dup = sorted({i for i in ids if ids.count(i) > 1})
        print(f'  ! ids repetidos en la planilla, se usa el primero: {dup}', file=sys.stderr)
        vistos = set()
        productos = [p for p in productos if not (p['id'] in vistos or vistos.add(p['id']))]
    estado = leer_estado()
    asignar_slugs(productos, estado)
    hoy = datetime.date.today().isoformat()
    en_uso = set()
    for p in productos:
        carpeta = FOTOS / slug(p['id'])
        fotos = []
        for origen in p.pop('fotos_origen'):
            # la primera foto que se pueda descargar es la que se usa al compartir y en Google Shopping
            f = convertir_foto(origen, carpeta, 'og' not in p, estado['fotos'])
            if f:
                fotos.append({k: v for k, v in f.items() if k != 'og'})
                if 'og' not in p and f.get('og'):
                    p['og'] = f['og']
                en_uso.update(v for k, v in f.items() if k in ('m', 'g', 'og') and v)
            else:
                fotos.append({'url': origen})
        p['fotos'] = fotos
        firma = huella_texto(json.dumps(p, sort_keys=True, ensure_ascii=False))
        previo = estado['productos'].get(p['id'], {})
        p['actualizado'] = previo.get('fecha', hoy) if previo.get('firma') == firma else hoy
        estado['productos'][p['id']] = {'firma': firma, 'fecha': p['actualizado'], 'slug': p['slug']}
    # Borrar fotos que ya no usa ningún producto
    if FOTOS.exists():
        for f in FOTOS.rglob('*'):
            if f.is_file() and '/fotos/' + f.relative_to(FOTOS).as_posix() not in en_uso:
                f.unlink()
        for d in sorted(FOTOS.glob('*'), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    estado['fotos'] = {k: v for k, v in estado['fotos'].items() if v.get('m') in en_uso}
    estado['productos'] = {k: v for k, v in estado['productos'].items() if k in set(ids)}
    guardar(productos, estado)
    return productos


def guardar(productos, estado):
    JSON_CATALOGO.parent.mkdir(parents=True, exist_ok=True)
    JSON_CATALOGO.write_text(json.dumps(productos, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    ESTADO.write_text(json.dumps(estado, ensure_ascii=False, indent=1, sort_keys=True), encoding='utf-8')


def cargar():
    """Catálogo guardado (sin internet). Lista vacía si todavía no existe."""
    if JSON_CATALOGO.exists():
        return json.loads(JSON_CATALOGO.read_text(encoding='utf-8'))
    return []
