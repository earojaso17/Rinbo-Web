# RINBŌ Ichiba — web v1 (catálogo)

Sitio estático: catálogo + Cómo funciona + Acerca de. Sin datos de clientes (fase 1).

## Antes de publicar
0. (Opcional) Subir a img/ las fotos del carrusel: portada.jpg, slide-2.jpg, slide-3.jpg, slide-4.jpg. Títulos editables en CONFIG.heroSlides (js/app.js).
1. `js/app.js` → CONFIG.whatsapp: reemplazar "81XXXXXXXXX" por el número real sin "+".
2. (Opcional ahora) CONFIG.sheetCsvUrl: URL CSV de la planilla pública. Vacío = productos de muestra.

## Publicar en GitHub Pages
1. Crear repo `rinbo-web` (público) en GitHub.
2. Subir todos los archivos de esta carpeta (Add file → Upload files).
3. Settings → Pages → Source: "Deploy from a branch" → Branch: main, carpeta / (root) → Save.
4. En 1-2 min el sitio queda en https://TU-USUARIO.github.io/rinbo-web/

## Conectar dominio rinbo.store (después de verificar que el sitio funciona)
1. Settings → Pages → Custom domain: rinbo.store → Save (crea el archivo CNAME).
2. En Wix DNS agregar 4 registros A (host @): 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153
3. CNAME: host `www` → valor `TU-USUARIO.github.io`
4. De vuelta en GitHub Pages: marcar "Enforce HTTPS" cuando se habilite (puede tardar unas horas).

## Páginas del sitio
- index.html: portada (carrusel, destacados, encargos, ofertas, contacto)
- tienda.html: La Tienda — catálogo completo con filtros de 3 niveles
- producto.html?id=XXX: ficha individual (foto grande, galería, agregar a cotización)
- como-funciona.html / acerca.html / faq.html / seguimiento.html (placeholder fase 2)
- Carrito de cotización: botón "Cotización" en el header; arma el mensaje de WhatsApp con todos los productos

## Conectar la planilla (cuando exista RINBO_Publica)
1. En la planilla pública: Archivo → Compartir → Publicar en la web → pestaña Catálogo → formato CSV → Publicar.
2. Copiar la URL generada y pegarla en CONFIG.sheetCsvUrl.
3. La pestaña Catálogo debe tener las columnas: id, nombre, categoria_principal, categoria_secundaria, detalle, opcion_1, opcion_2, descripcion, estado, precio_clp, precio_oferta, stock, foto_1, foto_2, foto_3, publicado, destacado. Formato de opciones: "Talla: S | M | L".
