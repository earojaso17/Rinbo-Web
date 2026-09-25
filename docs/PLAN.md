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

## Fase 1 — pasos
1. Inventario de TODOS los registros DNS actuales en Wix.
2. Cuenta Cloudflare + agregar rinbo.store (plan Free); comparar lo que Cloudflare detecta con el inventario y completar.
3. Cambiar nameservers en Wix → Cloudflare, con el sitio aún apuntando a GitHub Pages (solo cambia el DNS).
4. Pruebas de correo (envío y recepción en hola@ y pedidos@) y de DNS.
5. Mover el sitio a `web/`, crear proyecto Cloudflare Pages, validar en *.pages.dev.
6. Conectar rinbo.store y www a Cloudflare Pages; apagar GitHub Pages.
