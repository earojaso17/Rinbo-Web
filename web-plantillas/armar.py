# Arma todo el sitio web/ a partir de las plantillas de esta carpeta y del catálogo.
#
# Uso (desde la raíz del repo):
#   python3 web-plantillas/armar.py              arma con el catálogo ya guardado (web/datos/catalogo.json)
#   python3 web-plantillas/armar.py --catalogo   además descarga la planilla y las fotos (lo hace el robot de GitHub)
#
# Genera: las 7 páginas fijas, una página por producto (/producto/<nombre>/), una por categoría
# (/tienda/<categoria>/), sitemap.xml, robots.txt, el feed de Google Merchant (feeds/google-merchant.xml)
# y css/rinbo.css. A rinbo.css, rinbo.js y og-card.jpg les agrega ?v=<huella> para evitar versiones viejas en caché.
import datetime
import hashlib
import os
import html
import json
import pathlib
import re
import sys
import urllib.parse

import catalogo as cat

# ---------- CONFIGURACIÓN ----------
SITIO = 'https://rinbo.store'
# Código de verificación de Google Search Console (solo si Google lo pide con "etiqueta HTML").
# Hoy el dominio ya está verificado por DNS (registro TXT en Wix), así que puede quedar vacío.
SEARCH_CONSOLE = ''
# Dirección desde donde WhatsApp/Facebook descargan la foto de cada producto. En producción = SITIO;
# en una rama de prueba el robot la cambia a su vista previa de Cloudflare (variable OG_BASE) para poder probarla.
OG_BASE = os.environ.get('OG_BASE', '').rstrip('/') or SITIO
# -----------------------------------

AQUI = pathlib.Path(__file__).parent
WEB = AQUI.parent / 'web'
CSS = ['_base.css', '_tienda.css', '_paginas.css', '_tienda2.css', '_ajustes.css']
NOMBRE = 'RINBŌ Ichiba'
INSTAGRAM = 'https://www.instagram.com/rinbo.store/'

NAV = [('tienda.html', 'Tienda', '市場'), ('como-funciona.html', 'Cómo funciona', '流れ'), ('acerca.html', 'Nosotros', '私たち'), ('faq.html', 'FAQ', '質問'), ('seguimiento.html', 'Seguimiento', '追跡')]
DESC = 'Cartas TCG Pokémon y One Piece, poleras UT de Uniqlo, relojes Seiko y Casio, skincare japonés y encargos personal shopper. Comprados en persona en Japón, con precios finales en CLP.'
# Descripciones: las mismas que Google ya muestra del sitio anterior
DESC_PAG = {
    'index': DESC,
    'tienda': 'La Tienda de Rinbō: coleccionables, vestuario, relojes, tecnología y más, comprados en persona en Japón. Precios finales en CLP.',
    'como-funciona': 'Encargar es simple: eliges o encargas, cotizamos, compramos en Japón y llega a tu puerta. Precios finales en CLP.',
    'acerca': 'Detrás de Rinbō hay personas viviendo en Japón: compramos en persona, en tiendas oficiales y con boleta.',
    'faq': 'Originalidad, pagos, plazos, envíos y devoluciones: todo lo que nos preguntan antes de encargar.',
    'seguimiento': 'Consulta el estado de tu pedido. Sistema de seguimiento en línea.',
    'producto': DESC,
}
OG_TITULO = 'RINBŌ Ichiba — Lo que solo se consigue en Japón'
OG_DESC = 'Productos japoneses auténticos, comprados en persona en Japón y enviados a Chile. Coleccionables, vestuario, relojes y encargos. Precios finales en CLP.'
RUTA = '''<div class="route mono" aria-label="Desde Japón a Chile"><strong>JP</strong> 日本<span class="leg" aria-hidden="true"><svg class="i"><use href="#i-plane"/></svg></span><strong>CL</strong> Chile</div>'''

esc = lambda s: html.escape(str(s or ''), quote=True)
saltos = lambda s: esc(s).replace('\n', '<br>')
fmt = lambda n: '$' + f'{int(n):,}'.replace(',', '.')
V = {}  # huellas para ?v=
WHATSAPP = cat.config_js('whatsapp')
KANJI = {}


def huella(ruta):
    return hashlib.sha1(ruta.read_bytes()).hexdigest()[:8]


def wa(msg):
    return f'https://wa.me/{WHATSAPP}?text={urllib.parse.quote(msg)}'


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'


def texto_plano(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def recortar(texto, n=155):
    t = re.sub(r'\s+', ' ', str(texto or '')).strip()
    if len(t) <= n:
        return t
    return t[:n].rsplit(' ', 1)[0].rstrip(' ,.;:—-') + '…'


# ---------- Piezas de producto (mismo HTML que genera rinbo.js) ----------
def kanji(c):
    return KANJI.get(c, '品')


def foto_src(f, grande=False):
    if 'url' in f:
        m = re.search(r'/d/([a-zA-Z0-9_-]+)', f['url']) or re.search(r'[?&]id=([a-zA-Z0-9_-]+)', f['url'])
        return f"https://drive.google.com/thumbnail?id={m.group(1)}&sz=w{1000 if grande else 600}" if m and 'google.' in f['url'] else f['url']
    return f['g'] if grande else f['m']


def ph(src, jp, alt, dentro='', eager=False, w=None, h=None):
    if not src:
        return f'<div class="ph noimg" data-jp="{esc(jp)}">{dentro}</div>'
    dim = f' width="{w}" height="{h}"' if w and h else ''
    carga = ' fetchpriority="high"' if eager else ' loading="lazy"'
    return f'<div class="ph" data-jp="{esc(jp)}"><img src="{esc(src)}" alt="{esc(alt)}"{dim}{carga} decoding="async" onerror="this.parentNode.classList.add(\'noimg\')">{dentro}</div>'


def foto_prod(p, i=0, grande=False, dentro='', eager=False):
    if i >= len(p['fotos']):
        return ph('', kanji(p['cat']), p['nombre'], dentro)
    f = p['fotos'][i]
    alt = p['nombre'] if i == 0 else f"{p['nombre']} — foto {i + 1}"
    return ph(foto_src(f, grande), kanji(p['cat']), alt, dentro, eager, f.get('w'), f.get('h'))


def url_prod(p):
    return f"/producto/{p['slug']}/"


def url_cat(c):
    return f'/tienda/{cat.slug(c)}/'


def card(p, eager=False):
    v, of = cat.vendido(p), cat.en_oferta(p)
    flags = ''.join(x for x in [
        v and '<span class="flag sold">Vendido</span>',
        not v and of and '<span class="flag sale">Oferta</span>',
        cat.usado(p) and '<span class="flag used">Segunda mano</span>',
        not v and p['stock'] == 'En Chile' and '<span class="flag cl">En Chile</span>'] if x)
    if v:
        price = '<span class="clp ask">Vendido</span>'
    elif not p['precio']:
        price = '<span class="clp ask">A consultar</span>'
    elif of:
        price = f'<span class="clp sale num">{fmt(p["oferta"])}</span><s class="num">{fmt(p["precio"])}</s>'
    else:
        price = f'<span class="clp num">{fmt(p["precio"])}</span><span class="yen mono">CLP</span>'
    if v:
        btn = f'<button class="btn btn-line" type="button" data-like="{esc(p["id"])}">Encargar uno igual <span class="ico"><svg class="i"><use href="#i-arrow"/></svg></span></button>'
    elif any(len(o['valores']) > 1 for o in p['ops']):
        btn = f'<a class="btn btn-line" href="{url_prod(p)}">Elegir opciones <span class="ico"><svg class="i"><use href="#i-list"/></svg></span></a>'
    else:
        btn = f'<button class="btn btn-line" type="button" data-add="{esc(p["id"])}">Agregar a cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button>'
    u = url_prod(p)
    return f'''<article class="card{' sold' if v else ''}">
      <a href="{u}" tabindex="-1" aria-hidden="true" style="display:block">{foto_prod(p, 0, False, f'<div class="flags">{flags}</div>', eager)}</a>
      <div class="meta mono"><span>{esc(p['sub'] or p['cat'])}</span></div>
      <h3><a href="{u}">{esc(p['nombre'])}</a></h3>
      <p class="sub">{esc(p['detalle'])}</p>
      <div class="price">{price}</div>
      {btn}
    </article>'''


def pdp(p):
    v, of = cat.vendido(p), cat.en_oferta(p)
    n = max(1, len(p['fotos']))
    filas = [[c.strip() for c in f.split('|')] for f in re.split(r'\n|;', p['tabla']) if f.strip()]
    tabla = ''
    if len(filas) > 1:
        tabla = '<div class="size-table"><table><thead><tr>' + ''.join(f'<th>{esc(c)}</th>' for c in filas[0]) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{esc(c)}</td>' for c in r) + '</tr>' for r in filas[1:]) + '</tbody></table></div>'
    if v and not p['precio']:
        precio = '<div class="big">Vendido</div><p class="note">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>'
    elif not p['precio']:
        precio = '<div class="big">Precio a consultar</div><p class="note">El valor en Japón varía según demanda — se confirma en tu cotización</p>'
    elif v:
        precio = f'<div class="big"><s>{fmt(cat.precio_activo(p))}</s> Vendido</div><p class="note">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>'
    elif of:
        precio = f'<div class="big sale num">{fmt(p["oferta"])} <small>CLP</small> <s>{fmt(p["precio"])}</s></div><p class="note">Precio final en oferta · impuestos incluidos</p>'
    else:
        precio = f'<div class="big num">{fmt(p["precio"])} <small>CLP</small></div><p class="note">Precio final · impuestos incluidos</p>'
    if p['stock'] == 'En Chile':
        stock = '<span class="badge cl"><span class="dot"></span>En Chile · despacho inmediato</span>'
    elif v or not p['stock']:
        stock = ''
    else:
        stock = f'<span class="badge jp-st"><span class="dot"></span>{esc(p["stock"])} · 2-4 semanas est.</span>'
    ops = ''
    if not v and p['ops']:
        ops = ''.join(f'<div class="opt-group"><span>{esc(o["nombre"])} <em data-sel="{esc(o["nombre"])}">{esc(o["valores"][0])}</em></span><div class="opt-btns" data-op="{esc(o["nombre"])}">' + ''.join(f'<button type="button" aria-pressed="{"true" if k == 0 else "false"}" data-v="{esc(x)}">{esc(x)}</button>' for k, x in enumerate(o['valores'])) + '</div></div>' for o in p['ops'])
    comprar = (f'<button class="btn btn-ink" type="button" data-like="{esc(p["id"])}">Encargar uno igual <span class="ico"><svg class="i"><use href="#i-arrow"/></svg></span></button>' if v
               else '<button class="btn btn-ai" type="button" id="addPdp">Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button>')
    ig = f'<a class="ig-post" href="{esc(p["ig"])}" target="_blank" rel="noopener"><span class="ig-post-ic"><svg class="i"><use href="#i-ig"/></svg></span><span><b>Míralo en Instagram</b><small>@rinbo.store</small></span><svg class="i"><use href="#i-arrow"/></svg></a>' if p['ig'] else ''
    thumbs = ''
    if n > 1:
        thumbs = '<div class="g-bar"><div class="thumbs" id="thumbs">' + ''.join(f'<button type="button" aria-label="Foto {k + 1}" aria-current="{"true" if k == 0 else "false"}">{foto_prod(p, k)}</button>' for k in range(n)) + f'</div><span class="g-count mono num" id="gCount">1 / {n}</span></div>'
    return f'''
        <div class="gallery">
          <div class="g-track" id="gTrack">{''.join(foto_prod(p, k, True, eager=(k == 0)) for k in range(n))}</div>
          {thumbs}
        </div>
        <div class="pdp-info">
          <span class="cat mono">{esc(p['cat'])}{' · ' + esc(p['sub']) if p['sub'] else ''}</span>
          <h1 class="display">{esc(p['nombre'])}</h1>
          {f'<p class="detail">{esc(p["detalle"])}</p>' if p['detalle'] else ''}
          <div class="badges">{f'<span class="badge">{esc(p["estado"])}</span>' if p['estado'] else ''}{stock}</div>
          <div class="pdp-price">{precio}</div>
          {ops}
          <div class="buy">{comprar}</div>
          {ig}
          {f'<div class="desc"><p>{saltos(p["desc"])}</p></div>' if p['desc'] else ''}
          {tabla}
          {f'<p class="detail" style="font-size:.9rem;color:var(--muted)">{saltos(p["pie"])}</p>' if p['pie'] else ''}
        </div>'''


PROMO = '<aside class="promo"><span class="big-jp" aria-hidden="true">代行</span><span class="mono" style="position:relative;opacity:.8">Servicio de encargos</span><h2 class="display">¿Buscas algo que no está en el catálogo?</h2><p>Si se consigue en Japón, lo encontramos: cámaras, figuras, instrumentos, ediciones limitadas, lo que sea.</p><a class="btn" href="#" data-open-encargo2>Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></a></aside>'


# ---------- Datos estructurados ----------
def ld_tienda():
    return {
        '@context': 'https://schema.org', '@type': 'OnlineStore', '@id': SITIO + '/#tienda',
        'name': NOMBRE, 'alternateName': ['RINBŌ', 'Rinbō', 'Rinbo Store'], 'url': SITIO + '/',
        'logo': SITIO + '/img/logo.png', 'image': f'{SITIO}/img/og-card.jpg', 'description': OG_DESC,
        'slogan': 'Lo que solo se consigue en Japón', 'areaServed': {'@type': 'Country', 'name': 'Chile'},
        'currenciesAccepted': 'CLP', 'sameAs': [INSTAGRAM],
        'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer service', 'telephone': '+' + WHATSAPP,
                         'url': f'https://wa.me/{WHATSAPP}', 'availableLanguage': 'es'},
    }


def ld_sitio():
    return {'@context': 'https://schema.org', '@type': 'WebSite', '@id': SITIO + '/#sitio', 'name': NOMBRE,
            'url': SITIO + '/', 'inLanguage': 'es', 'publisher': {'@id': SITIO + '/#tienda'}}


def ld_migas(items):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITIO + u} for i, (n, u) in enumerate(items)]}


DISPONIBILIDAD = {'vendido': 'SoldOut', 'por encargo': 'PreOrder', 'en chile': 'InStock', 'en japón': 'InStock', 'en japon': 'InStock'}


def disponibilidad(p):
    return DISPONIBILIDAD.get(p['stock'].strip().lower(), 'InStock')


def imagenes_abs(p):
    return [SITIO + f['g'] if 'g' in f else foto_src(f, True) for f in p['fotos']]


def ld_producto(p):
    d = {'@context': 'https://schema.org', '@type': 'Product', 'name': p['nombre'], 'sku': p['id'], 'productID': p['id'],
         'url': SITIO + url_prod(p), 'category': ' > '.join(x for x in (p['cat'], p['sub']) if x)}
    if p['fotos']:
        d['image'] = imagenes_abs(p)
    texto = ' '.join(x for x in (p['desc'], p['detalle']) if x) or p['nombre']
    d['description'] = re.sub(r'\s+', ' ', texto).strip()
    if p.get('marca'):
        d['brand'] = {'@type': 'Brand', 'name': p['marca']}
    if p['precio'] > 0:  # sin precio ("A consultar") no se publica oferta: no se inventa un precio
        d['offers'] = {'@type': 'Offer', 'url': SITIO + url_prod(p), 'priceCurrency': 'CLP', 'price': cat.precio_activo(p),
                       'availability': 'https://schema.org/' + disponibilidad(p),
                       'itemCondition': 'https://schema.org/' + ('UsedCondition' if cat.usado(p) else 'NewCondition'),
                       'seller': {'@id': SITIO + '/#tienda'}}
    return d


def ld_faq(contenido):
    preguntas = re.findall(r'<article class="qa"><h3>(.*?)</h3><p>(.*?)</p></article>', contenido, re.S)
    limpio = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s)).strip()
    return {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': limpio(q), 'acceptedAnswer': {'@type': 'Answer', 'text': limpio(a)}} for q, a in preguntas]}


# ---------- Página completa ----------
def migas(items):
    partes = ['<a href="/">Inicio</a>']
    for href, t, extra in items:
        partes.append('<span aria-hidden="true">/</span>' + (f'<a href="{href}"{extra}>{esc(t)}</a>' if href else f'<span aria-current="page">{esc(t)}</span>'))
    return f'<nav class="crumbs mono" aria-label="Ruta de navegación">{"".join(partes)}</nav>'


def absolutos(s):
    """Los links internos pasan a ser desde la raíz (/tienda.html), para que funcionen también dentro de /producto/…/"""
    s = re.sub(r'(href|src)="(?!https?:|#|/|mailto:|data:)([^"]+)"', r'\1="/\2"', s)
    return s.replace('href="/index.html"', 'href="/"')


def escribir(ruta, texto):
    destino = WEB / ruta
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding='utf-8')


def pagina(ruta, *, titulo, desc, canonical, main, nav_actual='', og_img=None, og_tipo='website', jsonld=(), robots='', preload='', defs=''):
    cur = lambda f: ' aria-current="page"' if f == nav_actual else ''
    seg = lambda f: ' class="nav-seg"' if f == 'seguimiento.html' else ''
    links = ''.join(f'<li><a href="/{f}"{seg(f)}{cur(f)}>{t}</a></li>' for f, t, _ in NAV)
    menu = '<li><a href="/">Inicio <span class="jp">ホーム</span></a></li>' + ''.join(f'<li><a href="/{f}"{seg(f)}>{t} <span class="jp">{jp}</span></a></li>' for f, t, jp in NAV)
    pie = ''.join(f'<a href="/{f}">{t}</a>' for f, t, _ in [('', 'Inicio', '')] + NAV)
    og_img = og_img or (f'{SITIO}/img/og-card.jpg?v={V["og"]}', 1200, 630)
    og_dim = f'\n<meta property="og:image:width" content="{og_img[1]}">\n<meta property="og:image:height" content="{og_img[2]}">' if og_img[1] else ''
    cabeza_extra = ''
    if robots:
        cabeza_extra += f'\n<meta name="robots" content="{robots}">'
    if canonical:
        cabeza_extra += f'\n<link rel="canonical" href="{canonical}">'
    if SEARCH_CONSOLE:
        cabeza_extra += f'\n<meta name="google-site-verification" content="{esc(SEARCH_CONSOLE)}">'
    if preload:
        cabeza_extra += f'\n<link rel="preload" as="image" href="{preload}" fetchpriority="high">'
    main = re.sub(r'data-wa="([^"]*)" href="#"', lambda m: f'data-wa="{m.group(1)}" href="{esc(wa(html.unescape(m.group(1))))}"', main)
    salida = f'''<!DOCTYPE html>
<!-- Generado por web-plantillas/armar.py: no editar aquí, sino en web-plantillas/ -->
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(titulo)}</title>
<meta name="description" content="{esc(desc)}">{cabeza_extra}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap">
<link rel="stylesheet" href="/css/rinbo.css?v={V['css']}">
<link rel="icon" type="image/png" sizes="512x512" href="/img/logo.png">
<link rel="apple-touch-icon" href="/img/logo.png">
<meta name="theme-color" content="#990000">
<meta property="og:site_name" content="{NOMBRE}">
<meta property="og:locale" content="es_CL">
<meta property="og:title" content="{esc(titulo if og_tipo == 'product' else (OG_TITULO if ruta == 'index.html' else titulo))}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{esc(og_img[0])}">{og_dim}
<meta property="og:url" content="{canonical or SITIO + '/'}">
<meta property="og:type" content="{og_tipo}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(titulo)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{esc(og_img[0])}">
{''.join(ld(x) for x in jsonld)}
</head>
<body>
{defs}

<a class="skip" href="#main">Saltar al contenido</a>
<div class="grain" aria-hidden="true"></div>

<header class="nav">
  <div class="wrap">
    <div class="nav-in">
      <a class="brand" href="/" aria-label="RINBŌ Ichiba, inicio">
        <img class="logo" src="/img/logo.png" alt="" width="40" height="40">
        <span><b>RINBŌ</b> <small>Ichiba</small></span>
      </a>
      <ul class="nav-links">{links}</ul>
      <button class="quote-btn" type="button" id="openQuote" aria-label="Abrir cotización"><span>Cotización</span><span class="count num">0</span></button>
      <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="menu" aria-label="Menú"><span></span><span></span></button>
    </div>
  </div>
</header>

<nav class="menu" id="menu" aria-label="Menú principal">
  <ul>{menu}</ul>
  <div class="menu-foot mono"><span>Desde Japón a Chile</span><a class="ig-link" href="{INSTAGRAM}" target="_blank" rel="noopener"><svg class="i"><use href="#i-ig"/></svg>@rinbo.store</a></div>
</nav>

{main}

<footer id="contacto">
  <div class="wrap">
    <div class="talk">
      <div style="display:grid;gap:1rem">
        <span class="mono" style="color:var(--muted)">Contacto</span>
        <h2 class="display">¿Hablamos?</h2>
        <p class="lede">Asesoría para elegir, ayuda con un encargo o cualquier pregunta — te responde una persona, directo desde Japón.</p>
      </div>
      <div style="display:grid;gap:14px;justify-items:start">
        <a class="btn btn-ai" data-wa="¡Hola! Tengo una consulta" href="{esc(wa('¡Hola! Tengo una consulta'))}" target="_blank" rel="noopener">Escríbenos por WhatsApp <span class="ico"><svg class="i"><use href="#i-chat"/></svg></span></a>
        <a class="btn btn-line" href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram @rinbo.store <span class="ico"><svg class="i"><use href="#i-ig"/></svg></span></a>
      </div>
    </div>
    <div class="wordmark" aria-hidden="true"><b>RINBŌ</b><span class="jp">輪宝</span></div>
    <nav class="foot-links" aria-label="Pie de página">{pie}<a href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram</a></nav>
    <div class="legal mono"><span>RINBŌ Ichiba · rinbo.store</span><span>Lo que solo se consigue en Japón</span></div>
  </div>
</footer>

<div class="backdrop" id="backdrop"></div>
<aside class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t" aria-hidden="true">
  <div class="grab" aria-hidden="true"></div>
  <div class="sheet-head"><h2 id="sheet-t">Tu cotización</h2><button class="x" type="button" data-close aria-label="Cerrar"><svg class="i"><use href="#i-close"/></svg></button></div>
  <div class="sheet-scroll">
    <ul class="items" id="items"></ul>
    <form class="enc" id="encForm">
      <label for="encInput"><span class="jp">代行</span>¿Buscas algo que no está en el catálogo?</label>
      <input class="input" type="text" id="encInput" maxlength="140" placeholder="Ej: Lente Canon 50mm f1.8, figura de..." aria-label="Qué quieres encargar">
      <div class="row-btn"><button class="btn btn-ink btn-sm" type="submit">Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button></div>
    </form>
  </div>
  <div class="sheet-foot" id="sheetFoot">
    <div class="sum"><span>Total referencial</span><b class="num" id="total">$0</b></div>
    <p class="fine">Precios finales, impuestos incluidos · cualquier excepción se informa antes de comprar</p>
    <a class="btn btn-ai" id="sendQuote" href="#" target="_blank" rel="noopener">Pedir cotización por WhatsApp <span class="ico"><svg class="i"><use href="#i-chat"/></svg></span></a>
  </div>
</aside>
<div class="toast" id="toast" role="status" aria-live="polite"><svg class="i"><use href="#i-check"/></svg><span id="toastTxt"></span></div>
<script src="/js/rinbo.js?v={V['js']}" defer></script>
</body>
</html>
'''
    salida = re.sub(r'<span class="vk" aria-hidden="true">(.*?)</span>', r'<span class="pg-mark" aria-hidden="true"><span class="vk">\g<1></span><span class="stamp"><svg viewBox="0 0 120 120"><use href="#hanko"/></svg></span></span>', salida)
    escribir(ruta, salida)


def plantilla(nombre):
    src = (AQUI / 'paginas' / f'{nombre}.html').read_text(encoding='utf-8')
    titulo, contenido = src.split('\n', 1)
    return titulo.strip(), absolutos(contenido.replace('{ROUTE}', RUTA)).rstrip()


def poner_migas(contenido, items):
    a = contenido.index('{CRUMBS:')
    b = contenido.index('}', a)
    return contenido[:a] + migas(items) + contenido[b + 1:]


def llenar(contenido, id_, html_):
    """Pone contenido dentro del elemento con ese id (que en la plantilla está vacío)."""
    return re.sub(rf'(id="{id_}"[^>]*>)(</(?:div|ul|nav|span)>)', lambda m: m.group(1) + html_ + m.group(2), contenido, count=1)


# ---------- Páginas ----------
def paginas_fijas(P, defs):
    comun = dict(defs=defs)
    # Portada: destacados, Instagram y ofertas ya escritos en el HTML (rinbo.js los vuelve a pintar igual)
    titulo, c = plantilla('index')
    js = (WEB / 'js' / 'rinbo.js').read_text(encoding='utf-8')
    slides = re.findall(r'\{ img: "([^"]*)", titulo: "([^"]*)", texto: "([^"]*)", jp: "([^"]*)" \}', js)
    if slides:
        c = llenar(c, 'slides', ''.join(f'<div class="slide" aria-label="{k + 1} de {len(slides)}">{ph(img, jp, "", "", k == 0)}<div class="cap"><b>{esc(tt)}</b>{f"<span>{esc(tx)}</span>" if tx else ""}</div></div>' for k, (img, tt, tx, jp) in enumerate(slides)))
        if len(slides) > 1:
            actual = ' aria-current="true"'
            c = llenar(c, 'dots', ''.join(f'<button type="button" aria-label="Slide {k + 1}"{actual if k == 0 else ""}></button>' for k in range(len(slides))))
    if P:
        dest = [p for p in P if p['destacado']] or [p for p in P if not cat.vendido(p)][:4]
        c = llenar(c, 'rail', ''.join(card(p) for p in dest))
        con_foto = [p for p in reversed(P) if p['fotos']]
        ig = [p for p in con_foto if p['ig']] + [p for p in con_foto if not p['ig']]
        n = 6 if len(ig) >= 6 else 3 if len(ig) >= 3 else 0
        if n:
            tiles = ''.join(f'<a class="ig-tile" href="{esc(p["ig"] or INSTAGRAM)}" target="_blank" rel="noopener" aria-label="Ver en Instagram: {esc(p["nombre"])}">{foto_prod(p)}<span class="ig-ov"><svg class="i"><use href="#i-ig"/></svg></span></a>' for p in ig[:n])
            c = c.replace('<div class="ig-grid rv" id="igGrid" hidden></div>', f'<div class="ig-grid rv{" ig-3" if n == 3 else ""}" id="igGrid">{tiles}</div>')
        of = sorted([p for p in P if cat.en_oferta(p) and not cat.vendido(p)], key=lambda p: -(p['precio'] - p['oferta']) / p['precio'])[:6]
        c = llenar(c, 'deals', ''.join(f'<li><a class="deal" href="{url_prod(p)}">{foto_prod(p)}<div><b>{esc(p["nombre"])}</b><small>{esc(p["detalle"])}</small></div><div class="pr"><span class="num">{fmt(p["oferta"])}</span><s class="num">{fmt(p["precio"])}</s></div></a></li>' for p in of))
    pagina('index.html', titulo=titulo, desc=DESC_PAG['index'], canonical=SITIO + '/', main=c,
           jsonld=[ld_tienda(), ld_sitio()], preload='/img/portada.webp', **comun)

    for nombre in ['como-funciona', 'acerca', 'faq', 'seguimiento']:
        titulo, c = plantilla(nombre)
        texto_miga = re.search(r'\{CRUMBS:([^}]*)\}', c).group(1)
        c = poner_migas(c, [('', texto_miga, '')])
        jsonld = [ld_migas([('Inicio', '/'), (texto_miga, f'/{nombre}.html')])]
        if nombre == 'faq':
            jsonld.append(ld_faq(c))
        pagina(f'{nombre}.html', titulo=titulo, desc=DESC_PAG[nombre], canonical=f'{SITIO}/{nombre}.html', main=c,
               nav_actual=f'{nombre}.html', jsonld=jsonld, **comun)

    # Dirección antigua producto.html?id=… : redirige a /producto/<nombre>/ (no se indexa)
    titulo, c = plantilla('producto')
    c = poner_migas(c, [('/tienda.html', 'Tienda', ''), ('#cat', 'Categoría', ' id="crumbCat"')])
    pagina('producto.html', titulo=titulo, desc=DESC_PAG['producto'], canonical='', main=c, nav_actual='tienda.html',
           robots='noindex, follow', **comun)


def paginas_tienda(P, defs):
    titulo, base = plantilla('tienda')
    cats = list(dict.fromkeys(p['cat'] for p in P if p['cat']))
    def nav(actual):
        items = [('Todos', '全', '/tienda.html', len(P), actual is None)] + [(c, kanji(c), url_cat(c), sum(1 for p in P if p['cat'] == c), actual == c) for c in cats]
        return ''.join(f'<a class="cat-link" href="{u}" data-cat="{esc(k if k != "Todos" else "todos")}" aria-current="{"true" if a else "false"}"><span class="jp">{jp}</span>{esc(k)}<span class="n num">{n}</span></a>' for k, jp, u, n, a in items)
    def orden(lista):
        return sorted(lista, key=lambda p: (cat.vendido(p), not p['destacado']))
    def cuenta(c, lista):
        n = len(lista)
        c = llenar(c, 'count-txt', f'<b class="num">{n}</b> {"producto" if n == 1 else "productos"}')
        return llenar(c, 'seeN', str(n))
    def grilla(lista):
        celdas = [card(p, k < 4) for k, p in enumerate(orden(lista)[:12])]
        celdas.insert(min(6, len(celdas)), PROMO)
        return ''.join(celdas)
    # Tienda general
    c = poner_migas(base, [('', 'Tienda', '')])
    if P:
        c = llenar(c, 'catNav', nav(None))
        c = llenar(c, 'grid', grilla(P))
        c = cuenta(c, P)
    pagina('tienda.html', titulo=titulo, desc=DESC_PAG['tienda'], canonical=SITIO + '/tienda.html', main=c, nav_actual='tienda.html',
           jsonld=[ld_migas([('Inicio', '/'), ('Tienda', '/tienda.html')])], defs=defs)
    # Una página por categoría: /tienda/<categoria>/
    for k in cats:
        lista = [p for p in P if p['cat'] == k]
        subs = list(dict.fromkeys(p['sub'] for p in lista if p['sub']))
        c = poner_migas(base, [('/tienda.html', 'Tienda', ''), ('', k, '')])
        c = c.replace('data-page="tienda"', f'data-page="tienda" data-cat="{esc(k)}"')
        c = c.replace('<h1 class="display" id="pageTitle">Tienda</h1>', f'<h1 class="display" id="pageTitle">{esc(k)}</h1>')
        c = llenar(c, 'catNav', nav(k))
        c = llenar(c, 'grid', grilla(lista))
        c = cuenta(c, lista)
        if subs:
            chips = ''.join(f'<button class="chip sm" type="button" data-sub="{esc(s)}" aria-pressed="{"true" if s == "todas" else "false"}">{"Todas" if s == "todas" else esc(s)}</button>' for s in ['todas'] + subs)
            c = c.replace('<div class="sub-nav" id="subNav" role="group" aria-label="Subcategorías" hidden></div>', f'<div class="sub-nav" id="subNav" role="group" aria-label="Subcategorías">{chips}</div>')
        desc = recortar(f'{k}: {" · ".join(subs)}. Comprados en persona en Japón, con precios finales en CLP.' if subs else f'{k}. Comprados en persona en Japón, con precios finales en CLP.')
        pagina(f'tienda/{cat.slug(k)}/index.html', titulo=f'{k} — Tienda — {NOMBRE}', desc=desc, canonical=SITIO + url_cat(k), main=c,
               nav_actual='tienda.html', jsonld=[ld_migas([('Inicio', '/'), ('Tienda', '/tienda.html'), (k, url_cat(k))])], defs=defs)
    return cats


def paginas_producto(P, defs, estado):
    for p in P:
        rel = [x for x in P if x['cat'] == p['cat'] and x['id'] != p['id'] and not cat.vendido(x)]
        lista = (rel or [x for x in P if x['id'] != p['id'] and x['destacado']])[:4]
        relacionados = ''
        if lista:
            relacionados = f'''
    <section class="section" style="padding-top:0" aria-labelledby="relTitle">
      <div class="prod-head"><h2 class="display h2" id="relTitle">{esc(p['cat'] if rel else 'Destacados')}</h2><a class="link" href="/tienda.html">Ver toda la Tienda →</a></div>
      <div class="grid" id="rel">{''.join(card(x) for x in lista)}</div>
    </section>'''
        miga_cat = [(url_cat(p['cat']), p['cat'], ' id="crumbCat"')] if p['cat'] else []
        main = f'''<main id="main" data-page="producto" data-id="{esc(p['id'])}">
  <div class="wrap">
    {migas([('/tienda.html', 'Tienda', '')] + miga_cat)}
    <div class="pdp" id="producto" data-static="1" style="margin-top:1.4rem">{pdp(p)}</div>{relacionados}
  </div>
</main>'''
        desc = recortar(f"{p['nombre']}. {p['desc'] or p['detalle']}" if (p['desc'] or p['detalle']) else f"{p['nombre']}. Comprado en persona en Japón, con precio final en CLP.")
        f0 = p['fotos'][0] if p['fotos'] else None
        og = (OG_BASE + p['og'], 1080, 1080) if p.get('og') else ((foto_src(f0, True), None, None) if f0 else None)
        migas_ld = [('Inicio', '/'), ('Tienda', '/tienda.html')] + ([(p['cat'], url_cat(p['cat']))] if p['cat'] else []) + [(p['nombre'], url_prod(p))]
        pagina(f"producto/{p['slug']}/index.html", titulo=f"{p['nombre']} — {NOMBRE}", desc=desc, canonical=SITIO + url_prod(p),
               main=main, nav_actual='tienda.html', og_img=og, og_tipo='product', jsonld=[ld_producto(p), ld_migas(migas_ld)], defs=defs)
    # Direcciones antiguas (el producto cambió de nombre): redirigen a la nueva
    por_id = {p['id']: p for p in P}
    for viejo, pid in estado.get('slugs_antiguos', {}).items():
        if pid in por_id:
            nuevo = SITIO + url_prod(por_id[pid])
            escribir(f'producto/{viejo}/index.html', f'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>{esc(por_id[pid]["nombre"])}</title><link rel="canonical" href="{nuevo}"><meta http-equiv="refresh" content="0; url={nuevo}"></head><body><a href="{nuevo}">{esc(por_id[pid]["nombre"])}</a></body></html>\n')


def limpiar_generadas(carpeta, validas):
    """Borra páginas de productos/categorías que ya no existen en la planilla."""
    raiz = WEB / carpeta
    if not raiz.exists():
        return
    for d in raiz.iterdir():
        if d.is_dir() and d.name not in validas:
            for f in d.rglob('*'):
                f.unlink()
            d.rmdir()


def sitemap(P, cats):
    hoy = datetime.date.today().isoformat()
    urls = [('/', '1.0', None, []), ('/tienda.html', '0.9', None, [])]
    urls += [(url_cat(c), '0.8', None, []) for c in cats]
    urls += [(url_prod(p), '0.7' if not cat.vendido(p) else '0.4', p.get('actualizado'), imagenes_abs(p)[:10]) for p in P]
    urls += [('/como-funciona.html', '0.6', None, []), ('/faq.html', '0.6', None, []), ('/acerca.html', '0.5', None, []), ('/seguimiento.html', '0.4', None, [])]
    filas = []
    for u, prio, fecha, imgs in urls:
        extra = f'<lastmod>{fecha}</lastmod>' if fecha else ''
        extra += ''.join(f'<image:image><image:loc>{esc(i)}</image:loc></image:image>' for i in imgs)
        filas.append(f'  <url><loc>{SITIO}{u}</loc>{extra}<priority>{prio}</priority></url>')
    escribir('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + '\n'.join(filas) + '\n</urlset>\n')
    escribir('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {SITIO}/sitemap.xml\n')
    return hoy


def feed_merchant(P):
    """Feed para Google Merchant Center (listados gratuitos de Google Shopping). Excluye vendidos y sin precio."""
    x = lambda s: html.escape(str(s or ''), quote=False)
    items = []
    fecha_encargo = (datetime.datetime.utcnow() + datetime.timedelta(days=28)).strftime('%Y-%m-%dT00:00Z')  # "2-4 semanas est."
    for p in P:
        if cat.vendido(p) or p['precio'] <= 0 or not p['fotos']:
            continue
        propias = [SITIO + f['g'] for f in p['fotos'] if 'g' in f]
        imgs = ([SITIO + p['og']] if p.get('og') else []) + propias + [foto_src(f, True) for f in p['fotos'] if 'url' in f]
        disp = {'PreOrder': 'preorder'}.get(disponibilidad(p), 'in_stock')
        partes = [f'<g:id>{x(p["id"])}</g:id>', f'<title>{x(p["nombre"][:150])}</title>',
                  f'<description>{x(texto_plano(p["desc"] or p["detalle"] or p["nombre"])[:5000])}</description>',
                  f'<link>{SITIO}{url_prod(p)}</link>', f'<g:image_link>{x(imgs[0])}</g:image_link>']
        partes += [f'<g:additional_image_link>{x(i)}</g:additional_image_link>' for i in imgs[1:11]]
        partes += [f'<g:availability>{disp}</g:availability>']
        if disp == 'preorder':
            partes.append(f'<g:availability_date>{fecha_encargo}</g:availability_date>')
        partes.append(f'<g:price>{p["precio"]} CLP</g:price>')
        if cat.en_oferta(p):
            partes.append(f'<g:sale_price>{p["oferta"]} CLP</g:sale_price>')
        partes.append(f'<g:condition>{"used" if cat.usado(p) else "new"}</g:condition>')
        if p.get('marca'):
            partes.append(f'<g:brand>{x(p["marca"])}</g:brand>')
        partes.append('<g:identifier_exists>no</g:identifier_exists>')
        partes.append(f'<g:product_type>{x(" > ".join(t for t in (p["cat"], p["sub"]) if t))}</g:product_type>')
        items.append('  <item>\n    ' + '\n    '.join(partes) + '\n  </item>')
    escribir('feeds/google-merchant.xml', f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>{NOMBRE}</title>
  <link>{SITIO}/</link>
  <description>{x(OG_DESC)}</description>
{chr(10).join(items)}
</channel>
</rss>
''')
    return len(items)


def fotos_portada():
    """Convierte las fotos del carrusel (img/*.jpg) a WebP livianas, si cambiaron."""
    try:
        from PIL import Image
    except ImportError:
        return
    for jpg in sorted((WEB / 'img').glob('*.jpg')):
        if jpg.name == 'og-card.jpg':
            continue
        webp = jpg.with_suffix('.webp')
        if webp.exists() and webp.stat().st_mtime >= jpg.stat().st_mtime:
            continue
        im = Image.open(jpg).convert('RGB')
        if im.width > 1000:
            im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        im.save(webp, 'WEBP', quality=78, method=6)


def main():
    global KANJI
    if '--catalogo' in sys.argv:
        try:
            P = cat.actualizar()
            print(f'Catálogo leído: {len(P)} productos publicados')
        except Exception as e:  # sin internet o Google caído: se arma con el catálogo guardado
            print(f'! No se pudo leer el catálogo ({e}); se usa el catálogo guardado.', file=sys.stderr)
            P = cat.cargar()
    else:
        P = cat.cargar()
    estado = cat.leer_estado()
    js = (WEB / 'js' / 'rinbo.js').read_text(encoding='utf-8')
    m = re.search(r'kanjiCategorias:\s*(\{[^}]*\})', js)
    KANJI = json.loads(m.group(1)) if m else {}
    fotos_portada()
    defs = (AQUI / 'comun.html').read_text(encoding='utf-8').strip()
    (WEB / 'css').mkdir(exist_ok=True)
    (WEB / 'css' / 'rinbo.css').write_text('/* RINBŌ Ichiba · estilos. Generado por web-plantillas/armar.py: no editar aquí, sino en web-plantillas/css/ */\n'
                                           + ''.join((AQUI / 'css' / f).read_text(encoding='utf-8') for f in CSS), encoding='utf-8')
    V.update(css=huella(WEB / 'css' / 'rinbo.css'), js=huella(WEB / 'js' / 'rinbo.js'), og=huella(WEB / 'img' / 'og-card.jpg'))
    paginas_fijas(P, defs)
    cats = paginas_tienda(P, defs)
    paginas_producto(P, defs, estado)
    limpiar_generadas('producto', {p['slug'] for p in P} | set(estado.get('slugs_antiguos', {})))
    limpiar_generadas('tienda', {cat.slug(c) for c in cats})
    sitemap(P, cats)
    n_feed = feed_merchant(P)
    print(f'Listo: {len(P)} productos, {len(cats)} categorías, {n_feed} en el feed de Merchant · css v={V["css"]} · js v={V["js"]}')


if __name__ == '__main__':
    main()
