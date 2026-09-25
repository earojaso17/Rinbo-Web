# Plan de evolución rinbo.store (aprobado 2026-09-25)

Decisiones fijas: Supabase (proyecto "rinbo", São Paulo, RLS, tablas no expuestas) · Cloudflare Pages con vista previa por rama · un repo con `web/` (pública) + `admin/` (RINBŌ Admin, Vite + React) + `supabase/` · Google Sheets se retira · bandeja de WhatsApp/Instagram SOLO lectura.

## Reglas acordadas
- SegPublica NO se despublica hasta la fase 6 (hay pedidos activos que la usan).
- Nada de cambios visuales en la web pública hasta la fase 7 (rediseño con mockup del dueño).
- Correo (Zoho: hola@ y pedidos@rinbo.store) no puede caerse: todos los registros DNS se copian y verifican ANTES de cambiar nameservers.
- Bandeja (plan gratis de Supabase): guardar texto e imágenes comprimidas; audios y videos solo como referencia (sin descargar).
- En la fase 2 se muestra cómo se controla el uso de almacenamiento.

## Fases
1. Migración a Cloudflare Pages (DNS con correo intacto → sitio en Cloudflare, igual que hoy).
2. Base de datos (tablas, RLS, buckets, funciones públicas, control de almacenamiento).
3. Admin: base + login + Cloudflare Access + productos con fotos.
4. Web lee catálogo desde Supabase (importar catálogo actual).
5. Admin: clientes y pedidos (9 etapas, pagos, evidencias).
6. Seguimiento nuevo (Edge Function, códigos no adivinables) + despublicar SegPublica.
7. Rediseño de la web pública (según mockup).
8. Bandeja WhatsApp (coexistencia, solo lectura).
9. Bandeja Instagram + chats por cliente.
10. Exportaciones JSON/CSV.
11. Cierre: despublicar Sheets, docs, revisión de seguridad.

## Cambio de estrategia (2026-09-25): el dominio se queda en Wix hasta marzo 2027
Wix NO permite cambiar los nameservers de un dominio comprado con ellos (NS "no editables").
Decisión (opción C): mantener el DNS en Wix hasta la renovación (6 mar 2027) y ahí transferir el dominio a otro registrador (p. ej. Porkbun/Namecheap), pagando la transferencia en lugar de la renovación.
- Hasta entonces: producción de la web pública sigue en GitHub Pages (rinbo.store). La Admin vive en Cloudflare Pages (`*.pages.dev`) protegida con Cloudflare Access. La web puede tener vistas previas en Cloudflare Pages (`*.pages.dev`) sin dominio.
- No editar el DNS en Wix salvo necesidad; nunca usar "Reintentar" ni "Asignar a un sitio" en Wix (reapuntaría el dominio a Wix).
- Zona rinbo.store en Cloudflare quedó creada (pendiente, NS asignados javier/sandy.ns.cloudflare.com) con los 12 registros; si Cloudflare la elimina por inactividad, se vuelve a agregar en 2027.

### Inventario DNS (Wix, 2026-09-25) — 12 registros
- A @ → 185.199.108.153 / .109.153 / .110.153 / .111.153 (GitHub Pages)
- CNAME www → earojaso17.github.io
- MX @ → mx.zoho.jp (10), mx2.zoho.jp (20), mx3.zoho.jp (30)
- TXT @ → `v=spf1 include:zohomail.jp ~all`
- TXT @ → `zoho-verification=zb48415574.zmverify.zoho.jp`
- TXT @ → `google-site-verification=tBfeY1nW42hefcrg_v7cypP8ew1cvg0ZZkwec4YV8uM`
- TXT zmail._domainkey → DKIM RSA 1024 (`v=DKIM1; k=rsa; p=MIGfMA0…RRaoiwIDAQAB`)
- Sin DMARC (pendiente para el cierre, empezar con `p=none`).
- DNSSEC: unsigned.
- Correo: un solo buzón Zoho (región JP) hola@rinbo.store; contacto@rinbo.store es alias. (pedidos@ no existe.)
- Línea base 2026-09-25: entrante OK (hola@, contacto@); saliente SPF PASS, DKIM PASS, DMARC FAIL (sin registro).

### Fase final nueva: "Transferencia de dominio + web a Cloudflare" (feb–mar 2027, antes del 6 mar)
1. Desbloquear dominio y pedir código de autorización en Wix; iniciar transferencia (tarda 5–7 días).
2. Al completarse, cambiar de inmediato los NS a Cloudflare (la zona ya tiene los 12 registros) para que el correo no se caiga.
3. Repetir la prueba de correo (entrante hola@/contacto@, saliente SPF/DKIM PASS).
4. Conectar rinbo.store y www a Cloudflare Pages; apagar GitHub Pages; agregar DMARC.

### Avance fase 1 (2026-09-25)
- [x] Repo reordenado en `web/`, `admin/`, `supabase/` (rama `claude/exciting-lovelace-4xfghh`); workflow `pages.yml` publica solo `web/`.
- [x] Proyecto Cloudflare Pages `rinbo-web` creado (Git, raíz `web`, sin build). Primer despliegue de `main` falla hasta que `main` tenga `web/` (esperado).
- [x] Vista previa de la rama verificada en `*.rinbo-web.pages.dev` (igual a rinbo.store).
- [x] GitHub Pages: Source = GitHub Actions; PR #1 unido a `main`; workflow OK; rinbo.store y rinbo-web.pages.dev verificados.
- Rollback si hiciera falta: Revert del PR #1 + Source → "Deploy from a branch" `main` / `(root)`.
- Desde ahora los archivos del sitio se editan en `web/` (p. ej. `web/js/app.js`).

## Cambio de orden (2026-09-25): el rediseño (fase 7) se adelanta
Decisión del dueño: aplicar ya el nuevo diseño (maqueta en `docs/diseno/mockup/`), conectado a la planilla actual. La fase 2 (Supabase) queda en pausa sin nada creado.
- Rama `claude/rediseno-web` → vista previa en Cloudflare Pages. rinbo.store no cambia hasta que el dueño apruebe y se una a `main`.
- `web/` ahora se genera con `web-plantillas/armar.py`; la lógica está en `web/js/rinbo.js` y `cargarCatalogo()` es la única pieza a cambiar en la fase 4.
- Se mantiene: links `producto.html?id=X`, cotización guardada (`rinbo_cotizacion_v3`), WhatsApp, lectura de SegPublica (solo lectura), etiquetas og:*, CNAME, sitemap, robots, _headers.
- Rollback cuando esté en `main`: Revert del PR del rediseño (vuelve el sitio anterior en ~2 min).

## SEO / SEM (2026-09-25)
Rama `claude/seo-sem` (encima del rediseño; un solo PR a `main` con ambas cosas).
- Páginas estáticas por producto (`/producto/<nombre>/`) y categoría (`/tienda/<categoria>/`), JSON-LD, sitemap, feed de Merchant y fotos WebP, generados por el robot de GitHub cada hora (`pages.yml`).
- Google Analytics 4 preparado (falta el ID del dueño) con aviso de cookies y eventos de conversión.
- Pasos manuales del dueño: `docs/SEO.md`. En la fase 4 (Supabase) cambia solo la fuente de `catalogo.py` y `cargarCatalogo()`.

### Avance fase 2 (2026-09-25)
- [x] Rediseño + SEO/SEM publicados (PR #2). Sitemap reenviado en Search Console: 26 páginas. GA4 `G-S9EZ38B7C9` activo.
- [x] Migración 1 aplicada: esquema privado `rinbo`, 9 tablas + `migraciones`, RLS en todas, 15 pruebas de seguridad OK (`supabase/pruebas/01_seguridad.sql`).
- [x] Migración 2: buckets `productos` (público) y `evidencias` (privado), reglas solo-admin, `uso_almacenamiento()` y `archivos_huerfanos()`.
- [x] Migración 3: funciones públicas `catalogo()` / `producto(id)` (se usan en la fase 4). Verificado desde internet: tablas y esquema `rinbo` no accesibles.
- [x] Auth: registros abiertos desactivados.
- [x] Usuario administrador `hola@rinbo.store` creado por el dueño en el panel y agregado a `rinbo.admins` (es_admin() verificado).
- [ ] Rotar el JWT secret antiguo (salió en un registro de la sesión; base aún sin datos reales) — opcional, antes de la fase 3.

### Avance fase 3 (2026-09-25)
- [x] Migración 4: `rinbo.ordenar_fotos()` (reordenar fotos en un paso; 3 pruebas OK).
- [x] App `admin/` (Vite + React): entrar, inicio con espacio del plan gratis, productos (buscar, filtrar, publicar), ficha (todos los campos de la planilla + marca), fotos (compresión en el navegador, ordenar, borrar). Probada con una base simulada.
- [x] Esquema `rinbo` expuesto en la Data API (lo hizo el dueño, opción A). Verificado: anon recibe "permission denied for schema rinbo" en tablas, inserción y funciones; `rpc/catalogo` sigue respondiendo.
- [x] Cloudflare Pages "rinbo-admin" (raíz `admin`, `npm run build`, `dist`, NODE_VERSION 22) + Cloudflare Access: app self-hosted `rinbo-admin.pages.dev` y `*.rinbo-admin.pages.dev`, política "Solo dueño" (emails hola@rinbo.store y la cuenta Gmail del dueño; entra con "Cloudflare"). Sesión 1 semana.
- [x] Prueba real con la cuenta hola@rinbo.store en la vista previa (entrar, productos importados).
- [x] Catálogo publicado importado a Supabase (15 productos, 78 fotos como links de Drive) con `supabase/importar/desde_catalogo_web.py`. Es una COPIA: la web sigue leyendo la planilla hasta la fase 4. Los productos no publicados de la planilla no se importaron.

### Fase 4 (2026-09-25) — rama `claude/fase4-catalogo`
- [x] Robot lee el catálogo desde Supabase (`public.catalogo()`, llave pública) cuando `CONFIG.fuenteCatalogo = "supabase"`; comparado contra la planilla: mismos 15 productos, mismo orden, mismos datos.
- [x] Robot cada 15 min (publica solo si cambió algo).
- [x] Admin: "Traer productos que faltan" desde la planilla (incluye no publicados) y link "Ver en rinbo.store".
- [x] Admin: botón "Publicar cambios ahora" (Cloudflare Pages Function + secreto GITHUB_TOKEN, configurado por el dueño el 2026-09-25 en Production y Preview).
- [ ] Revisión del dueño en la vista previa y publicación. Desde ese día la planilla deja de editarse (queda de respaldo).
- Volver atrás: `fuenteCatalogo: "planilla"` en web/js/rinbo.js (+ armar.py) o Revert del PR.

### Fases 5 y 6 (2026-09-25) — rama `claude/fase5-6-pedidos`
- [x] Migración 5 aplicada (15 pruebas OK): evidencias con link de Drive, contador R00001 que salta al importar, `rinbo.seguimiento_publico` (solo servidor, límite de intentos), `pedidos_resumen` con cliente.
- [x] Edge Function `seguimiento` publicada (verify_jwt=false); fotos privadas con links temporales de 1 hora.
- [x] Admin: Pedidos, Clientes, ficha de pedido (etapas, pagos, fotos, artículos, link de seguimiento por WhatsApp) e importación desde SegPublica.
  Probado contra la base real con un admin temporal (borrado junto con los datos de prueba).
- [x] Web: seguimiento con código secreto (ej. `K7QMX-4PAR9`) y link directo `rinbo.store/seguimiento.html#CÓDIGO`. Los códigos antiguos `R…` siguen leyendo SegPublica mientras esté publicada.
- [x] Pedidos de SegPublica importados y luego descartados por decisión del dueño (la plantilla no se usaba bien). Contador en R00396 para no repetir códigos antiguos.
- [x] `seguimientoCsvUrl: ""` (los códigos R… muestran "pide tu código nuevo") y botón de importar SegPublica quitado de la Admin.
- [ ] Dueño: despublicar SegPublica
  (Archivo → Compartir → Publicar en la web → pestaña SegPublica → Dejar de publicar). Volver atrás: publicarla de nuevo y restaurar la URL.
- Volver atrás de la fase 6 en la web: Revert del PR (la base y la Edge Function pueden quedar; no afectan a la web vieja).
- [x] Control de utilidad por pedido (migración 6, 4 pruebas OK): precio de venta, costo del producto, impuestos pagados y utilidad (solo el dueño la ve).

### Fase 8 (2026-09-25) — bandeja WhatsApp, rama `claude/fase8-whatsapp`
- Decisión: coexistencia vía **YCloud** (proveedor oficial con plan gratis; Meta no permite conectarla por cuenta propia sin ser proveedor). La app WhatsApp Business del celular sigue igual; solo lectura (nunca se envía desde la Admin).
- [x] Migración 7 aplicada (6 pruebas OK). Edge Function `whatsapp-webhook` publicada y probada con avisos firmados (entrante, enviado desde la app, foto, repetido, evento ajeno).
- [x] Admin: Mensajes + Chat + "Crear cliente" desde el chat + "Ver mensajes" en la ficha del cliente. Probado contra la base real (datos de prueba borrados).
- [ ] Dueño: cuenta YCloud → conectar el número (coexistencia; confirmar que +81 lo permite) → webhook a `…/functions/v1/whatsapp-webhook` → secreto `YCLOUD_WEBHOOK_SECRET` en Supabase.
- Volver atrás: en la app WhatsApp Business desconectar la plataforma (YCloud); en la Admin, Revert del PR.
