# Google: SEO, Shopping y medición — guía para el dueño

## Qué hace el sitio solo

- **Robot del catálogo** (GitHub → Actions → "Publicar web en GitHub Pages"): cada hora lee la planilla y, si algo cambió, rearma y publica el sitio. Para no esperar la hora: Actions → ese workflow → **Run workflow** → rama `main` → Run. Tarda 2–4 minutos.
- Cada producto tiene su página: `rinbo.store/producto/<nombre-del-producto>/`. Al compartirla por WhatsApp o Instagram se ve **la foto, el nombre y la descripción de ese producto**.
- Cada categoría tiene su página: `rinbo.store/tienda/relojes/`, etc.
- Los links antiguos `producto.html?id=…` siguen funcionando (redirigen al nuevo). Si cambias el nombre de un producto, la dirección anterior también redirige.
- `rinbo.store/sitemap.xml`: la lista de todas las páginas para Google (se actualiza sola).
- `rinbo.store/feeds/google-merchant.xml`: la lista de productos para Google Shopping (sin vendidos ni "A consultar"; se actualiza sola).

## Lo que debes hacer tú (una vez)

### 1. Google Search Console (ya lo tienes)
Tu dominio ya está verificado (registro `google-site-verification` en el DNS de Wix; no lo borres).
1. Entra a https://search.google.com/search-console y elige la propiedad **rinbo.store**.
2. Menú **Sitemaps** → escribe `sitemap.xml` → **Enviar**.
3. (Opcional) Menú **Inspección de URLs** → pega la dirección de un producto → **Solicitar indexación**, para acelerar.

### 2. Google Merchant Center (aparecer gratis en Shopping)
1. Entra a https://merchants.google.com con la misma cuenta de Google y crea la cuenta de la tienda (país: Chile, moneda: CLP, nombre: RINBŌ Ichiba, sitio: https://rinbo.store).
2. Verifica y reclama el sitio (si te ofrece "Search Console", elige esa opción: ya está verificado).
3. **Productos → Fuentes de datos → Agregar fuente → "Agregar productos desde un archivo" → "Ingresar un vínculo"**, pega `https://rinbo.store/feeds/google-merchant.xml`, frecuencia **diaria**.
4. Configura **Envío** (Chile, 2–4 semanas, costo incluido o el que corresponda) y **Devoluciones** (como en tu página "Cómo funciona").
5. Revisa **Diagnóstico** en unos días: te dirá si algún producto necesita algo (por ejemplo, marca).
   - Si quieres informar la marca, agrega una columna `marca` a la planilla (opcional).

### 3. Google Analytics 4
1. Entra a https://analytics.google.com → **Administrar → Crear → Propiedad** (zona horaria de Chile, moneda CLP) → flujo de datos **Web** → `https://rinbo.store`.
2. Copia el **ID de medición** (empieza con `G-`) y pásaselo a Claude. Él lo pone en el sitio (un solo lugar) y se activa el aviso de cookies.
3. Cuando lleguen datos (1–2 días): **Administrar → Eventos** → marca como **evento clave**: `pedir_cotizacion_whatsapp`, `contacto_whatsapp` (y si quieres `agregar_cotizacion`).
4. Para Google Ads: en Google Ads → **Objetivos → Conversiones → Importar → Google Analytics 4** → elige esos eventos clave.

### 4. Link para la biografía de Instagram
```
https://rinbo.store/?utm_source=instagram&utm_medium=social&utm_campaign=bio
```
Para historias o publicaciones puedes cambiar el final, por ejemplo `utm_campaign=historia-relojes`.

## Cómo comprobar que quedó bien

- **Prueba de resultados enriquecidos**: https://search.google.com/test/rich-results → pega la dirección de un producto (ej. `https://rinbo.store/producto/…/`). Debe decir "Fragmentos de productos" / "Fichas de comerciante" válidos. Los productos "A consultar" no muestran precio (es correcto: no se inventa uno). Con `https://rinbo.store/faq.html` debe aparecer "Preguntas frecuentes".
- **PageSpeed Insights**: https://pagespeed.web.dev → pega `https://rinbo.store` → pestaña **Celular**. En pruebas locales dio SEO 100, Prácticas recomendadas 100 y Rendimiento 88–92.
- **Vista previa de WhatsApp**: pega el link de un producto en un chat contigo mismo. (WhatsApp guarda la vista previa de cada link varios días; un link nuevo la muestra al tiro.)
