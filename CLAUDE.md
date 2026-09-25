# CLAUDE.md — rinbo.store (RINBŌ Ichiba)

Sitio estático de RINBŌ Ichiba: catálogo de productos japoneses para Chile, cotización por WhatsApp y seguimiento de pedidos. Sin backend ni dependencias npm. Todo `web/` lo genera `web-plantillas/armar.py`; un robot de GitHub (`.github/workflows/pages.yml`) lo corre cada hora con la planilla y publica.

Repo con tres carpetas (ver `docs/PLAN.md`): `web/` (sitio público, lo único que se publica en rinbo.store), `admin/` (RINBŌ Admin, fase 3) y `supabase/` (base de datos, fase 2).

## Estructura de web/

```
index.html          Portada: carrusel, destacados, Instagram, encargos, ofertas, contacto (JSON-LD OnlineStore + WebSite)
tienda.html         Catálogo completo (12/pág) con categorías, subcategorías, casillas de filtro y orden
tienda/<cat>/       Una página por categoría (GENERADA por el robot)
producto/<nombre>/  Una página por producto con todo el contenido en el HTML + JSON-LD Product (GENERADA por el robot)
producto.html?id=X  Dirección antigua: redirige a /producto/<nombre>/ (noindex)
datos/catalogo.json Catálogo que lee rinbo.js (GENERADO por el robot; si no existe, rinbo.js lee la planilla directo)
fotos/<id>/         Fotos de productos en WebP 600/1200 + og-*.jpg (GENERADAS por el robot desde Google Drive)
feeds/google-merchant.xml  Feed para Google Merchant Center (GENERADO; excluye vendidos y sin precio)
sitemap.xml, robots.txt    GENERADOS
seguimiento.html    Consulta de pedido por código (ej. R00123) → línea de tiempo + estado de cuenta
como-funciona.html, acerca.html, faq.html   Contenido estático
js/rinbo.js         TODA la lógica (un solo archivo, cargado por todas las páginas). Se edita aquí.
css/rinbo.css       Todos los estilos. GENERADO: se edita en web-plantillas/css/
img/                Carrusel (portada.jpg, slide-2..5.jpg → .webp que usa el sitio), logo.png (favicon), og-card.jpg
CNAME               rinbo.store (dominio de GitHub Pages)
```

Links internos siempre desde la raíz (`/tienda.html`, `/img/…`), porque hay páginas en subcarpetas.

## web-plantillas/ (diseño 2026, no se publica)

Todo lo HTML de `web/`, `web/css/rinbo.css`, sitemap, robots y feed son **generados**: no editarlos a mano.
- `armar.py`: arriba tiene `SITIO` y `SEARCH_CONSOLE` (meta de verificación; hoy vacío porque el dominio está verificado por DNS). Escribe `<title>`, description, canonical, Open Graph/Twitter y JSON-LD de cada página (títulos/descripciones de las páginas fijas = las que Google ya tenía indexadas).
- `catalogo.py`: lee la planilla, convierte fotos a WebP (Pillow) y guarda `web/datos/catalogo.json` + `estado-catalogo.json` (memoria del robot: fotos ya convertidas, fecha de cambio de cada producto, direcciones antiguas si un producto cambia de nombre → redirección).
- `python3 web-plantillas/armar.py` arma con el catálogo guardado (sin internet); `--catalogo` además descarga planilla y fotos (lo hace el robot; desde el entorno de Claude Google está bloqueado).
- Columna opcional `marca` en la planilla → `brand` en JSON-LD y feed.
- `paginas/<nombre>.html`: 1ª línea = `<title>`, el resto = contenido de `<main>` (`data-page` activa la lógica de esa página).
- `comun.html`: íconos y sello SVG. Cabecera, menú, pie, panel de cotización y `<head>` (meta, og:*) están en `armar.py`.
- `css/_base.css, _tienda.css, _paginas.css, _tienda2.css` (diseño original) + `_ajustes.css` (ajustes para datos reales).
- Después de cualquier cambio (también en `web/js/rinbo.js`): `python3 web-plantillas/armar.py`. Agrega `?v=<huella>` a rinbo.css/rinbo.js para que los navegadores no usen la versión vieja.
- `og-card.html` + `og-card.js`: tarjeta para compartir (`web/img/og-card.jpg`, 1200x630; lo importante en el cuadrado central porque WhatsApp la recorta). Regenerar con `node web-plantillas/og-card.js` y luego `armar.py` (el `og:image` lleva `?v=` para que WhatsApp/Facebook no usen la vieja).
- La maqueta original del dueño está en `docs/diseno/mockup/` (solo referencia).

## js/rinbo.js

- `CONFIG` (arriba del archivo) es el único bloque pensado para editarse:
  - `whatsapp`: número sin "+" (hoy Japón, 81…). Todos los links `wa.me` salen de aquí.
  - `heroSlides`: imagen/título/texto del carrusel de portada.
  - `sheetCsvUrl`: CSV publicado de la pestaña Catálogo (planilla **RINBO_Publica**).
  - `seguimientoCsvUrl`: CSV publicado de la pestaña de seguimiento (**SegPublica**), mismo documento, otro `gid`.
  - `instagram`, `kanjiCategorias` (kanji decorativo por categoría; las nuevas usan 品).
- `ga4`: ID de Google Analytics 4. Vacío = sin Analytics y sin aviso de cookies. Con ID: aviso Aceptar/Rechazar (`localStorage` `rinbo_cookies`) y gtag se carga solo si acepta. Eventos: `pedir_cotizacion_whatsapp`, `contacto_whatsapp`, `agregar_cotizacion`, `consultar_pedido`, `clic_instagram`.
- `cargarCatalogo()` lee `/datos/catalogo.json` y, si no existe, la planilla. En la fase 4 se cambia `catalogo.py` + esta función para leer Supabase. Si falla, las páginas muestran "No pudimos cargar el catálogo".
- `init()` monta lo común, llama a `paginas[data-page]()` y, cuando llega el catálogo, a `paginas[data-page + "Datos"]()`. En `/producto/<nombre>/` la ficha ya viene escrita (`data-static`): `activarFicha()` solo conecta galería, opciones y botón.
- Carrito de cotización: `localStorage` clave `rinbo_cotizacion_v3` (no cambiarla: los clientes perderían su cotización); arma el mensaje de WhatsApp.
- Instagram en portada: fotos de productos con columna `instagram` (link), completadas con los productos más recientes.
- `parseCSV()` es un parser propio (maneja comillas y saltos de línea).

## De dónde vienen los datos

Ambas fuentes son Google Sheets "Publicar en la web → CSV", leídas con `fetch` desde el navegador del visitante.

**Catálogo** (`cargarCatalogo`): cabeceras en minúscula; se muestran solo filas con `id`, `nombre` y `publicado = SI`.
Columnas usadas: `id, nombre, categoria_principal, categoria_secundaria, detalle, opcion_1, opcion_2, descripcion, estado, precio_clp, precio_oferta, stock, foto_1..foto_12, publicado, destacado, tabla_tallas, detalle_pie, instagram`.
- `opcion_N`: `"Talla: S | M | L"`.
- `stock`: `"Vendido"` activa estado vendido; `"En Chile"` muestra despacho inmediato.
- `estado` con "usado"/"semi" → Segunda mano.
- `precio_clp` 0/vacío → "A consultar". `precio_oferta` solo aplica si es menor que `precio_clp`.
- Fotos: links de Google Drive se convierten a `drive.google.com/thumbnail?id=…&sz=w<ancho>` (`fotoUrl`; 600 en tarjetas, 1000 en ficha, 1600 al ampliar).
- `tabla_tallas`: filas separadas por salto de línea o `;`, celdas por `|`; la primera fila es cabecera.

**Seguimiento** (`paginas.seguimiento`): descarga el CSV completo y busca por `codigo` (normalizado a A-Z0-9 en mayúsculas).
Columnas: `codigo, etapa, fecha_etapa, comentario, evidencia_1..3, total_clp, abonado_clp, comentarios_generales`.
`etapa` debe coincidir **exactamente** con una de `ETAPAS` en rinbo.js (Encargo Confirmado, Comprado en Japón, En Bodega Japón, Enviado a Chile, En Tránsito a Chile, En Aduana, En Bodega Chile, Enviado, Entregado); si no, el pedido aparece como "no encontrado".

Los cambios en la planilla se reflejan en el sitio sin tocar el repo (Google cachea el CSV publicado unos minutos).

## Cómo se publica

- Producción: GitHub Pages con Source = "GitHub Actions". El workflow `.github/workflows/pages.yml`: job `catalogo` (cada hora, en push a `main` y a mano) corre `armar.py --catalogo` y hace commit si algo cambió (autor `rinbo-robot`; esos commits no re-disparan el workflow); job `publicar` (solo `main`) sube `web/`. "Run workflow" en otra rama sirve para ver el catálogo en su vista previa de Cloudflare.
- Como el robot hace commits en `main`, antes de trabajar hacer `git pull`. Si un PR choca en archivos generados, resolver volviendo a correr `armar.py` (no a mano).
- Dominio `rinbo.store` configurado en Settings → Pages + registros DNS en Wix (A a 185.199.108–111.153, `www` CNAME a github.io). El DNS se queda en Wix hasta la renovación de marzo 2027.
- Publicar = commit + push a `main`. Tarda ~1-2 minutos. Lo que entra a `main` queda en producción.
- Vista previa: Cloudflare Pages, proyecto `rinbo-web` (directorio raíz `web`, sin comando de build). Cada rama tiene su URL `<rama>.rinbo-web.pages.dev`; `main` → `rinbo-web.pages.dev`. `web/_headers` marca `*.pages.dev` como noindex.
- Para probar localmente: `cd web && python3 -m http.server` (fetch no funciona con `file://`).

## Convenciones

- Español en textos, nombres de variables y funciones.
- JS vanilla, sin frameworks. Fuentes de Google Fonts (Archivo, Geist, Geist Mono, Zen Kaku Gothic New).
- Todo texto que venga de la planilla se escapa (`esc`/`saltos`) antes de insertarlo en el HTML.
- SEO: no inventar textos (títulos/descripciones salen de textos existentes o de la planilla); "desde Japón a Chile", nunca ciudades de Japón; sin precios en yenes ni correo; contacto solo WhatsApp e Instagram. Guía para el dueño: `docs/SEO.md`.
