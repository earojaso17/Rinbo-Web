# Genera las páginas del mockup con cabecera, menú, pie y cotización compartidos.
# Uso: python _build.py   (desde la carpeta sitio)
import pathlib
ROOT = pathlib.Path(__file__).parent
defs = (ROOT / '_defs.html').read_text(encoding='utf-8').replace(
    '<symbol id="i-chat"',
    '<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>\n    '
    '<symbol id="i-ig" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/></symbol>\n    '
    '<symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>\n    <symbol id="i-chat"')

(ROOT / 'css' / 'rinbo.css').write_text(
    '/* RINBŌ Ichiba · estilos compartidos */\n' + ''.join((ROOT / 'css' / f).read_text(encoding='utf-8') for f in ['_base.css', '_tienda.css', '_paginas.css', '_tienda2.css']),
    encoding='utf-8')

NAV = [('tienda.html', 'Tienda', '市場'), ('como-funciona.html', 'Cómo funciona', '流れ'), ('acerca.html', 'Nosotros', '私たち'), ('faq.html', 'FAQ', '質問'), ('seguimiento.html', 'Seguimiento', '追跡')]
DESC = 'Cartas TCG Pokémon y One Piece, poleras UT de Uniqlo, relojes Seiko y Casio, skincare japonés y encargos personal shopper. Comprados en persona en Japón, con precios finales en CLP.'


def page(file, title, main, scripts=('js/catalogo.js', 'js/rinbo.js')):
    cur = lambda f: ' aria-current="page"' if f == file else ''
    seg = lambda f: ' class="nav-seg"' if f == 'seguimiento.html' else ''
    links = ''.join(f'<li><a href="{f}"{seg(f)}{cur(f)}>{t}</a></li>' for f, t, _ in NAV)
    menu = f'<li><a href="index.html">Inicio <span class="jp">ホーム</span></a></li>' + ''.join(f'<li><a href="{f}"{seg(f)}>{t} <span class="jp">{jp}</span></a></li>' for f, t, jp in NAV)
    foot = ''.join(f'<a href="{f}">{t}</a>' for f, t, _ in [('index.html', 'Inicio', '')] + NAV)
    js = ''.join(f'<script src="{s}"></script>\n' for s in scripts)
    html = f'''<!doctype html>
<title>{title}</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="{DESC}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap">
<link rel="stylesheet" href="css/rinbo.css">
<link rel="icon" type="image/png" href="img/favicon.png">
<link rel="apple-touch-icon" href="img/favicon.png">

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
    <nav class="foot-links" aria-label="Pie de página">{foot}<a href="https://www.instagram.com/rinbo.store/" target="_blank" rel="noopener">Instagram</a></nav>
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
{js}'''
    import re
    html = re.sub(r'<span class="vk" aria-hidden="true">(.*?)</span>', r'<span class="pg-mark" aria-hidden="true"><span class="vk">\g<1></span><span class="stamp"><svg viewBox="0 0 120 120"><use href="#hanko"/></svg></span></span>', html)
    (ROOT / file).write_text(html, encoding='utf-8')


def crumbs(*items):
    parts = ['<a href="index.html">Inicio</a>']
    for href, t in items:
        parts.append('<span aria-hidden="true">/</span>' + (f'<a href="{href}" id="{"crumbCat" if href == "#cat" else ""}">{t}</a>' if href else f'<span aria-current="page">{t}</span>'))
    return f'<nav class="crumbs mono" aria-label="Ruta de navegación">{"".join(parts)}</nav>'


ROUTE = '''<div class="route mono" aria-label="Desde Japón a Chile"><strong>JP</strong> 日本<span class="leg" aria-hidden="true"><svg class="i"><use href="#i-plane"/></svg></span><strong>CL</strong> Chile</div>'''


def head(eyebrow, h1, kanji, extra=''):
    return f'''<header class="page-head has-route">
      <div>
        <span class="mono" style="color:var(--ai)">{eyebrow}</span>
        <h1 class="display" style="margin-top:.6rem">{h1}</h1>
        {extra}
      </div>
      <span class="vk" aria-hidden="true">{kanji}</span>
    </header>'''


for name in ['index', 'tienda', 'producto', 'como-funciona', 'acerca', 'faq', 'seguimiento']:
    src = (ROOT / '_paginas' / f'{name}.html').read_text(encoding='utf-8')
    title, main = src.split('\n', 1)
    main = main.replace('{ROUTE}', ROUTE)
    if '{CRUMBS:' in main:
        a = main.index('{CRUMBS:'); b = main.index('}', a)
        spec = main[a + 8:b].split('|')
        main = main[:a] + crumbs(*[tuple(s.split('>')) if '>' in s else ('', s) for s in spec]) + main[b + 1:]
    scripts = ('js/catalogo.js', 'js/rinbo.js', 'js/tienda.js') if name == 'tienda' else ('js/catalogo.js', 'js/rinbo.js')
    page(f'{name}.html', title.strip(), main, scripts)
print('ok')
