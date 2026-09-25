# Arma las páginas de web/ a partir de las plantillas de esta carpeta.
# Uso (desde la raíz del repo):  python3 web-plantillas/armar.py
#
# - paginas/<nombre>.html: primera línea = <title>; el resto = contenido de <main>.
# - comun.html: íconos y sello (SVG) compartidos.
# - css/_*.css se unen en web/css/rinbo.css.
# - A rinbo.css y rinbo.js se les agrega ?v=<huella> para que los navegadores no usen una versión vieja.
#   Por eso, después de editar web/js/rinbo.js hay que volver a correr este script.
import hashlib
import html as h
import pathlib
import re

AQUI = pathlib.Path(__file__).parent
WEB = AQUI.parent / 'web'
CSS = ['_base.css', '_tienda.css', '_paginas.css', '_tienda2.css', '_ajustes.css']

NAV = [('tienda.html', 'Tienda', '市場'), ('como-funciona.html', 'Cómo funciona', '流れ'), ('acerca.html', 'Nosotros', '私たち'), ('faq.html', 'FAQ', '質問'), ('seguimiento.html', 'Seguimiento', '追跡')]
DESC = 'Cartas TCG Pokémon y One Piece, poleras UT de Uniqlo, relojes Seiko y Casio, skincare japonés y encargos personal shopper. Comprados en persona en Japón, con precios finales en CLP.'
DESC_PAG = {
    'index': DESC,
    'tienda': 'Catálogo de productos japoneses originales: cartas TCG, vestuario, relojes, segunda mano y más. Precios finales en CLP.',
    'como-funciona': 'Encargar es simple: eliges o encargas, cotizamos, compramos en Japón y llega a tu puerta. Precios finales en CLP.',
    'acerca': 'Detrás de Rinbō hay personas viviendo en Japón: compramos en persona, en tiendas oficiales y con boleta.',
    'faq': 'Originalidad, pagos, plazos, envíos y devoluciones: todo lo que nos preguntan antes de encargar.',
    'seguimiento': 'Consulta el estado de tu pedido. Sistema de seguimiento en línea.',
    'producto': DESC,
}
OG_DESC = 'Productos japoneses auténticos, comprados en persona en Japón y enviados a Chile. Coleccionables, vestuario, relojes y encargos. Precios finales en CLP.'


def huella(ruta):
    return hashlib.sha1(ruta.read_bytes()).hexdigest()[:8]


def armar_css():
    (WEB / 'css').mkdir(exist_ok=True)
    (WEB / 'css' / 'rinbo.css').write_text(
        '/* RINBŌ Ichiba · estilos. Generado por web-plantillas/armar.py: no editar aquí, sino en web-plantillas/css/ */\n'
        + ''.join((AQUI / 'css' / f).read_text(encoding='utf-8') for f in CSS),
        encoding='utf-8')


def pagina(nombre, titulo, main, defs, v_css, v_js):
    archivo = f'{nombre}.html'
    cur = lambda f: ' aria-current="page"' if f == archivo else ''
    seg = lambda f: ' class="nav-seg"' if f == 'seguimiento.html' else ''
    links = ''.join(f'<li><a href="{f}"{seg(f)}{cur(f)}>{t}</a></li>' for f, t, _ in NAV)
    menu = '<li><a href="index.html">Inicio <span class="jp">ホーム</span></a></li>' + ''.join(f'<li><a href="{f}"{seg(f)}>{t} <span class="jp">{jp}</span></a></li>' for f, t, jp in NAV)
    pie = ''.join(f'<a href="{f}">{t}</a>' for f, t, _ in [('index.html', 'Inicio', '')] + NAV)
    url = 'https://rinbo.store/' + ('' if nombre == 'index' else archivo)
    html = f'''<!DOCTYPE html>
<!-- Generado por web-plantillas/armar.py: no editar aquí, sino en web-plantillas/ -->
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{titulo}</title>
<meta name="description" content="{h.escape(DESC_PAG[nombre])}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap">
<link rel="stylesheet" href="css/rinbo.css?v={v_css}">
<link rel="icon" type="image/png" href="img/favicon.png">
<link rel="apple-touch-icon" href="img/favicon.png">
<meta property="og:site_name" content="RINBŌ Ichiba">
<meta property="og:title" content="RINBŌ Ichiba — Lo que solo se consigue en Japón">
<meta property="og:description" content="{OG_DESC}">
<meta property="og:image" content="https://rinbo.store/img/og-card.jpg">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
{defs}

<a class="skip" href="#main">Saltar al contenido</a>
<div class="grain" aria-hidden="true"></div>

<header class="nav">
  <div class="wrap">
    <div class="nav-in">
      <a class="brand" href="index.html" aria-label="RINBŌ Ichiba, inicio">
        <img class="logo" src="img/logo.png" alt="" width="40" height="40">
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
  <div class="menu-foot mono"><span>Desde Japón a Chile</span><a class="ig-link" href="https://www.instagram.com/rinbo.store/" target="_blank" rel="noopener"><svg class="i"><use href="#i-ig"/></svg>@rinbo.store</a></div>
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
        <a class="btn btn-ai" data-wa="¡Hola! Tengo una consulta" href="#" target="_blank" rel="noopener">Escríbenos por WhatsApp <span class="ico"><svg class="i"><use href="#i-chat"/></svg></span></a>
        <a class="btn btn-line" href="https://www.instagram.com/rinbo.store/" target="_blank" rel="noopener">Instagram @rinbo.store <span class="ico"><svg class="i"><use href="#i-ig"/></svg></span></a>
      </div>
    </div>
    <div class="wordmark" aria-hidden="true"><b>RINBŌ</b><span class="jp">輪宝</span></div>
    <nav class="foot-links" aria-label="Pie de página">{pie}<a href="https://www.instagram.com/rinbo.store/" target="_blank" rel="noopener">Instagram</a></nav>
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
<script src="js/rinbo.js?v={v_js}"></script>
</body>
</html>
'''
    html = re.sub(r'<span class="vk" aria-hidden="true">(.*?)</span>', r'<span class="pg-mark" aria-hidden="true"><span class="vk">\g<1></span><span class="stamp"><svg viewBox="0 0 120 120"><use href="#hanko"/></svg></span></span>', html)
    (WEB / archivo).write_text(html, encoding='utf-8')


def migas(*items):
    partes = ['<a href="index.html">Inicio</a>']
    for href, t in items:
        partes.append('<span aria-hidden="true">/</span>' + (f'<a href="{href}" id="{"crumbCat" if href == "#cat" else ""}">{t}</a>' if href else f'<span aria-current="page">{t}</span>'))
    return f'<nav class="crumbs mono" aria-label="Ruta de navegación">{"".join(partes)}</nav>'


RUTA = '''<div class="route mono" aria-label="Desde Japón a Chile"><strong>JP</strong> 日本<span class="leg" aria-hidden="true"><svg class="i"><use href="#i-plane"/></svg></span><strong>CL</strong> Chile</div>'''


def main():
    defs = (AQUI / 'comun.html').read_text(encoding='utf-8').strip()
    armar_css()
    v_css, v_js = huella(WEB / 'css' / 'rinbo.css'), huella(WEB / 'js' / 'rinbo.js')
    for nombre in ['index', 'tienda', 'producto', 'como-funciona', 'acerca', 'faq', 'seguimiento']:
        src = (AQUI / 'paginas' / f'{nombre}.html').read_text(encoding='utf-8')
        titulo, contenido = src.split('\n', 1)
        contenido = contenido.replace('{ROUTE}', RUTA)
        if '{CRUMBS:' in contenido:
            a = contenido.index('{CRUMBS:'); b = contenido.index('}', a)
            spec = contenido[a + 8:b].split('|')
            contenido = contenido[:a] + migas(*[tuple(s.split('>')) if '>' in s else ('', s) for s in spec]) + contenido[b + 1:]
        pagina(nombre, titulo.strip(), contenido.rstrip(), defs, v_css, v_js)
    print('Listo: 7 páginas, css/rinbo.css (v=%s), js/rinbo.js (v=%s)' % (v_css, v_js))


if __name__ == '__main__':
    main()
