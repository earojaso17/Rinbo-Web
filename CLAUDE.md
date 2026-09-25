# CLAUDE.md — rinbo.store (RINBŌ Ichiba)

Sitio estático de RINBŌ Ichiba: catálogo de productos japoneses para Chile, cotización por WhatsApp y seguimiento de pedidos. Sin backend ni dependencias npm; el hosting no ejecuta ningún build (las páginas HTML se generan localmente con `web-plantillas/armar.py` y se suben ya armadas).

Repo con tres carpetas (ver `docs/PLAN.md`): `web/` (sitio público, lo único que se publica en rinbo.store), `admin/` (RINBŌ Admin, fase 3) y `supabase/` (base de datos, fase 2).

## Estructura de web/

```
index.html          Portada: carrusel, destacados, Instagram, encargos, ofertas, contacto
tienda.html         Catálogo completo (12/pág) con categorías (tienda.html#slug), subcategorías, casillas de filtro y orden
producto.html?id=X  Ficha de producto (galería hasta foto_12, opciones, tabla de tallas)
seguimiento.html    Consulta de pedido por código (ej. R00123) → línea de tiempo + estado de cuenta
como-funciona.html, acerca.html, faq.html   Contenido estático
js/rinbo.js         TODA la lógica (un solo archivo, cargado por todas las páginas). Se edita aquí.
css/rinbo.css       Todos los estilos. GENERADO: se edita en web-plantillas/css/
img/                Carrusel (portada.jpg, slide-2..5.jpg), logo.png, favicon.png, og-card.jpg
CNAME               rinbo.store (dominio de GitHub Pages)
sitemap.xml, robots.txt
```

## web-plantillas/ (diseño 2026, no se publica)

Los 7 HTML de `web/` y `web/css/rinbo.css` son **generados**: no editarlos a mano.
- `paginas/<nombre>.html`: 1ª línea = `<title>`, el resto = contenido de `<main>` (`data-page` activa la lógica de esa página).
- `comun.html`: íconos y sello SVG. Cabecera, menú, pie, panel de cotización y `<head>` (meta, og:*) están en `armar.py`.
- `css/_base.css, _tienda.css, _paginas.css, _tienda2.css` (diseño original) + `_ajustes.css` (ajustes para datos reales).
- Después de cualquier cambio (también en `web/js/rinbo.js`): `python3 web-plantillas/armar.py`. Agrega `?v=<huella>` a rinbo.css/rinbo.js para que los navegadores no usen la versión vieja.
- La maqueta original del dueño está en `docs/diseno/mockup/` (solo referencia).

## js/rinbo.js

- `CONFIG` (arriba del archivo) es el único bloque pensado para editarse:
  - `whatsapp`: número sin "+" (hoy Japón, 81…). Todos los links `wa.me` salen de aquí.
  - `heroSlides`: imagen/título/texto del carrusel de portada.
  - `sheetCsvUrl`: CSV publicado de la pestaña Catálogo (planilla **RINBO_Publica**).
  - `seguimientoCsvUrl`: CSV publicado de la pestaña de seguimiento (**SegPublica**), mismo documento, otro `gid`.
  - `instagram`, `kanjiCategorias` (kanji decorativo por categoría; las nuevas usan 品).
- `cargarCatalogo()` es la única pieza que sabe de dónde vienen los productos (hoy la planilla; en la fase 4, Supabase). Si falla, las páginas muestran "No pudimos cargar el catálogo" (ya no hay productos de muestra).
- `init()` monta lo común, llama a `paginas[data-page]()` y, cuando llega el catálogo, a `paginas[data-page + "Datos"]()`.
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

- Producción: GitHub Pages con Source = "GitHub Actions". El workflow `.github/workflows/pages.yml` publica SOLO `web/` en cada push a `main` que toque `web/**` (o a mano con "Run workflow").
- Dominio `rinbo.store` configurado en Settings → Pages + registros DNS en Wix (A a 185.199.108–111.153, `www` CNAME a github.io). El DNS se queda en Wix hasta la renovación de marzo 2027.
- Publicar = commit + push a `main`. Tarda ~1-2 minutos. Lo que entra a `main` queda en producción.
- Vista previa: Cloudflare Pages, proyecto `rinbo-web` (directorio raíz `web`, sin comando de build). Cada rama tiene su URL `<rama>.rinbo-web.pages.dev`; `main` → `rinbo-web.pages.dev`. `web/_headers` marca `*.pages.dev` como noindex.
- Para probar localmente: `cd web && python3 -m http.server` (fetch no funciona con `file://`).

## Convenciones

- Español en textos, nombres de variables y funciones.
- JS vanilla, sin frameworks. Fuentes de Google Fonts (Archivo, Geist, Geist Mono, Zen Kaku Gothic New).
- Todo texto que venga de la planilla se escapa (`esc`/`saltos`) antes de insertarlo en el HTML.
