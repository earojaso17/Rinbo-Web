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
