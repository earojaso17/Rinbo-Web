# supabase/ — base de datos (proyecto "rinbo", São Paulo)

No se publica en ningún sitio web.

- `migraciones/` → `migrations/AAAAMMDDHHMMSS_nombre.sql`: cada cambio a la base, en orden. Cada archivo explica cómo deshacerlo.
  Se aplican con la Management API (`POST /v1/projects/mgxljvxjonopchpvmjkl/database/query`), porque desde el entorno de Claude
  la conexión directa a Postgres está bloqueada. Las aplicadas quedan registradas en la tabla `rinbo.migraciones`.
- `pruebas/`: pruebas de seguridad (RLS y permisos). Se corren dentro de una transacción que se deshace sola:
  migración sin su `commit` + la prueba + un `raise exception` final que devuelve los resultados (ver el historial de la fase 2).

## Diseño (fase 2)
- Esquema privado `rinbo` (no expuesto a la API pública; `anon` sin permisos). RLS en todas las tablas: solo `rinbo.es_admin()`.
- Tablas: `productos`, `producto_fotos`, `clientes`, `pedidos` (código `R00001` + `codigo_seguimiento` secreto), `pedido_items`,
  `pedido_etapas` (la etapa actual del pedido se calcula sola), `pagos` (vista `pedidos_resumen` con abonado y saldo),
  `evidencias`, `admins` (se agregan solo por SQL), `migraciones`.
- Buckets: `productos` (público, 1 MB, webp/jpeg/png) y `evidencias` (privado, 1 MB). Solo admins suben/cambian/borran.
- Control de espacio: `rinbo.uso_almacenamiento()` (base 500 MB, archivos 1 GB, por carpeta, huérfanos) y
  `rinbo.archivos_huerfanos()`. Solo admins (`rinbo.exigir_admin()`; ojo: en funciones security definer se mira el JWT, no current_user).
- "Ventanilla" pública (rol anon): `public.catalogo()` y `public.producto(p_id)` → solo publicados, mismas columnas que la planilla + `fotos`.
  Desde internet: `POST https://mgxljvxjonopchpvmjkl.supabase.co/rest/v1/rpc/catalogo` con la llave pública.
- Auth: registros abiertos desactivados (`disable_signup = true`). Los usuarios se crean solo desde el panel de Supabase.

## Migraciones aplicadas
| Versión | Qué hace | Pruebas |
|---|---|---|
| 20260925000001 | esquema `rinbo`, tablas, RLS | `pruebas/01_seguridad.sql` (15 OK) |
| 20260925000002 | buckets, reglas de archivos, control de espacio | `pruebas/02_almacenamiento_y_catalogo.sql` |
| 20260925000003 | funciones públicas del catálogo | `pruebas/02_almacenamiento_y_catalogo.sql` (12 OK) |
