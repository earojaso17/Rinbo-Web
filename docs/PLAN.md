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
- [ ] Verificar vista previa de la rama en `*.rinbo-web.pages.dev`.
- [ ] GitHub Pages: Source = GitHub Actions, luego merge a `main` y verificar rinbo.store.
