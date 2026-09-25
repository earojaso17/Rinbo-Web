# Diseño nuevo de la web pública (mockup del dueño, 2026-09-25)

`mockup/` es el "look and feel" aprobado para el rediseño (fase 7, adelantada). Es solo referencia: no se publica. La versión real está en `web/` y se arma desde `web-plantillas/`.

- Se abre localmente con `cd docs/diseno/mockup && python3 -m http.server` → http://localhost:8000
- `_build.py` arma las 7 páginas a partir de `_paginas/` + `_defs.html` (cabecera, menú, pie y cotización compartidos) y une los CSS en `css/rinbo.css`.
- Es una maqueta: el catálogo es una copia fija (`js/catalogo.js`), las fotos son de relleno (picsum.photos) y el seguimiento usa un pedido de ejemplo.

Al aplicarlo en `web/` hay que conservar lo que hoy hace el sitio real:
- Datos reales (planilla hoy, Supabase desde la fase 4), fotos reales, seguimiento real.
- Links `producto.html?id=X` (el mockup usa `#X`; los links ya compartidos no deben romperse).
- Etiquetas para compartir (og:*), `CNAME`, `sitemap.xml`, `robots.txt`, `_headers`.
- Clave del carrito `rinbo_cotizacion_v3` y número de WhatsApp desde un solo lugar.
