# CLAUDE.md — rinbo.store (RINBŌ Ichiba)

Sitio estático de RINBŌ Ichiba: catálogo de productos japoneses para Chile, cotización por WhatsApp y seguimiento de pedidos. Sin backend, sin build, sin dependencias npm.

## Estructura

```
index.html          Portada: carrusel, destacados, catálogo (8/pág), encargos, ofertas, contacto
tienda.html         Catálogo completo (16/pág) con filtros: categoría → subcategoría → estado
producto.html?id=X  Ficha de producto (galería hasta foto_12, opciones, tabla de tallas)
seguimiento.html    Consulta de pedido por código (ej. R00123) → línea de tiempo + estado de cuenta
como-funciona.html, acerca.html, faq.html   Contenido estático
js/app.js           TODA la lógica (un solo archivo, cargado por todas las páginas)
css/styles.css      Todos los estilos
img/                Carrusel (portada.jpg, slide-2..5.jpg), favicon.png, og-card.jpg
CNAME               rinbo.store (dominio de GitHub Pages)
sitemap.xml, robots.txt
```

Header, nav y footer están **duplicados a mano en cada HTML** (no hay includes). Un cambio de menú o footer se hace en los 7 archivos.

## js/app.js

- `CONFIG` (arriba del archivo) es el único bloque pensado para editarse:
  - `whatsapp`: número sin "+" (hoy Japón, 81…). Todos los links `wa.me` salen de aquí.
  - `heroSlides`: imagen/título/texto del carrusel de portada.
  - `sheetCsvUrl`: CSV publicado de la pestaña Catálogo (planilla **RINBO_Publica**).
  - `seguimientoCsvUrl`: CSV publicado de la pestaña de seguimiento (**SegPublica**), mismo documento, otro `gid`.
- `PRODUCTOS_MUESTRA`: productos de respaldo si falla la carga de la planilla.
- `init()` corre en `DOMContentLoaded` en todas las páginas y activa cada módulo según los IDs presentes en el HTML (`#grilla`, `#producto`, `#seg-form`, `#hero-carrusel`, `#destacados`, `#banda-ofertas`…).
- Carrito de cotización: `localStorage` clave `rinbo_cotizacion_v3`; el drawer se inyecta por JS y arma un mensaje de WhatsApp.
- `parseCSV()` es un parser propio (maneja comillas y saltos de línea).

## De dónde vienen los datos

Ambas fuentes son Google Sheets "Publicar en la web → CSV", leídas con `fetch` desde el navegador del visitante.

**Catálogo** (`cargarPlanilla`): cabeceras en minúscula; se muestran solo filas con `id`, `nombre` y `publicado = SI`.
Columnas usadas: `id, nombre, categoria_principal, categoria_secundaria, detalle, opcion_1, opcion_2, descripcion, estado, precio_clp, precio_oferta, stock, foto_1..foto_12, publicado, destacado, tabla_tallas, detalle_pie`.
- `opcion_N`: `"Talla: S | M | L"`.
- `stock`: `"Vendido"` activa estado vendido; `"En Chile"` muestra despacho inmediato.
- `estado` con "usado"/"semi" → Segunda mano.
- `precio_clp` 0/vacío → "A consultar". `precio_oferta` solo aplica si es menor que `precio_clp`.
- Fotos: links de Google Drive se convierten a `drive.google.com/thumbnail?id=…&sz=w1000` (`fotoDrive`).
- `tabla_tallas`: filas separadas por salto de línea o `;`, celdas por `|`; la primera fila es cabecera.

**Seguimiento** (`buscarPedido`): descarga el CSV completo y busca por `codigo` (normalizado a A-Z0-9 en mayúsculas).
Columnas: `codigo, etapa, fecha_etapa, comentario, evidencia_1..3, total_clp, abonado_clp, comentarios_generales`.
`etapa` debe coincidir **exactamente** con una de `ETAPAS` en app.js (Encargo Confirmado, Comprado en Japón, En Bodega Japón, Enviado a Chile, En Tránsito a Chile, En Aduana, En Bodega Chile, Enviado, Entregado); si no, el pedido aparece como "no encontrado".

Los cambios en la planilla se reflejan en el sitio sin tocar el repo (Google cachea el CSV publicado unos minutos).

## Cómo se publica

- GitHub Pages, "Deploy from a branch": rama `main`, carpeta `/` (root). No hay workflow propio; GitHub ejecuta `pages-build-deployment` en cada push a `main`.
- Dominio `rinbo.store` vía archivo `CNAME` + registros DNS en Wix (A a 185.199.108–111.153, `www` CNAME a github.io).
- Publicar = commit + push a `main`. Tarda ~1-2 minutos. No hay entorno de pruebas: lo que entra a `main` queda en producción.
- Para probar localmente: `python3 -m http.server` en la raíz (fetch no funciona con `file://`).

## Convenciones

- Español en textos, nombres de variables y funciones.
- JS vanilla, sin frameworks ni build. Fuentes de Google Fonts (Karla, JetBrains Mono, Shippori Mincho).
- Al subir `js/app.js` o `css/styles.css`, los navegadores pueden servir la versión en caché (no hay versionado `?v=`).
