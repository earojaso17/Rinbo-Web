# supabase/ — base de datos (proyecto "rinbo", São Paulo)

No se publica en ningún sitio web.

- `migraciones/` → `migrations/AAAAMMDDHHMMSS_nombre.sql`: cada cambio a la base, en orden. Cada archivo explica cómo deshacerlo.
  Se aplican con la Management API (`POST /v1/projects/mgxljvxjonopchpvmjkl/database/query`), porque desde el entorno de Claude
  la conexión directa a Postgres está bloqueada. Las aplicadas quedan registradas en la tabla `rinbo.migraciones`.
- `pruebas/`: pruebas de seguridad (RLS y permisos). Se corren dentro de una transacción que se deshace sola:
  migración sin su `commit` + la prueba + un `raise exception` final que devuelve los resultados (ver el historial de la fase 2).
  Ojo: los contadores (secuencias) NO se deshacen con la transacción; después de un ensayo que crea pedidos, dejar
  `rinbo.pedidos_codigo_seq` como estaba (`select setval('rinbo.pedidos_codigo_seq', 1, false)` si no hay pedidos).
- `functions/seguimiento/index.ts`: Edge Function del seguimiento (fase 6). Se publica con la Management API:
  `curl -X POST "https://api.supabase.com/v1/projects/mgxljvxjonopchpvmjkl/functions/deploy?slug=seguimiento" -F 'metadata={"entrypoint_path":"index.ts","name":"seguimiento","verify_jwt":false};type=application/json' -F "file=@index.ts;type=application/typescript"`
  (desde `supabase/functions/seguimiento/`). `verify_jwt=false`: la llama cualquiera, pero solo responde con el código secreto.

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
- Seguimiento (fase 6): la web llama a la Edge Function `seguimiento` (`POST …/functions/v1/seguimiento {"codigo"}`), que con la
  llave de servidor llama a `rinbo.seguimiento_publico(código, huella IP)` (solo `service_role`): devuelve solo etapas y fotos
  marcadas visibles, total/abonado y comentarios generales (nunca notas internas ni datos del cliente), y limita a 10 códigos
  equivocados por IP cada 15 min (`rinbo.consultas_seguimiento`, se borra a los 2 días). Las fotos del bucket privado salen
  como links temporales de 1 hora; las importadas de SegPublica (`evidencias.url_externa`) son los links de Drive de siempre.
- WhatsApp (fase 8): YCloud (coexistencia con la app WhatsApp Business) avisa a la Edge Function `whatsapp-webhook`
  (`verify_jwt=false`), que exige la firma `YCloud-Signature` (HMAC-SHA256 de `"<t>.<cuerpo>"` con el secreto
  `YCLOUD_WEBHOOK_SECRET`, configurado por el dueño en Supabase → Edge Functions → Secrets) y guarda cada mensaje una vez
  (`wamid` único). Entrante/saliente según el número de la tienda (`TIENDA_WHATSAPP`, por defecto 819039343820).
  Cada aviso firmado se guarda completo en `whatsapp_eventos` (respaldo, reprocesable) y luego se buscan en todo el aviso
  los objetos con `wamid` (también listas del historial); la fecha es la original (`sendTime`/`timestamp` antes que `createTime`).
  Fotos/audios no se descargan (solo el tipo y el texto o pie de foto). Publicar: igual que `seguimiento`, con `slug=whatsapp-webhook`.
- Códigos de pedido: `R00001…` automáticos; al importar `R00127` el contador salta solo (trigger `ajustar_contador_pedidos`).
- Auth: registros abiertos desactivados (`disable_signup = true`). Los usuarios se crean solo desde el panel de Supabase.

## Migraciones aplicadas
| Versión | Qué hace | Pruebas |
|---|---|---|
| 20260925000001 | esquema `rinbo`, tablas, RLS | `pruebas/01_seguridad.sql` (15 OK) |
| 20260925000002 | buckets, reglas de archivos, control de espacio | `pruebas/02_almacenamiento_y_catalogo.sql` |
| 20260925000003 | funciones públicas del catálogo | `pruebas/02_almacenamiento_y_catalogo.sql` (12 OK) |
| 20260925000004 | ordenar fotos (`rinbo.ordenar_fotos`) | `pruebas/03_ordenar_fotos.sql` (3 OK) |
| 20260925000005 | pedidos y seguimiento público (evidencias con link, contador R, `seguimiento_publico`, límite de intentos) | `pruebas/04_pedidos_y_seguimiento.sql` (15 OK) |
| 20260925000006 | control de utilidad: `pedidos.costo_clp`, `impuestos_clp`; `pedidos_resumen.utilidad_clp` (privado) | `pruebas/05_control_utilidad.sql` (4 OK) |
| 20260925000007 | bandeja WhatsApp: `whatsapp_mensajes` (admins solo leen/borran; escribe el servidor) + vista `whatsapp_conversaciones` | `pruebas/06_whatsapp_mensajes.sql` (6 OK) |
| 20260926000008 | `whatsapp_eventos`: respaldo de cada aviso de YCloud antes de procesarlo (historial `whatsapp.smb.history`, contactos…) | `pruebas/07_whatsapp_eventos.sql` (3 OK) |
| 20260926000009 | `guardar_aviso_whatsapp()`: respaldo + mensajes en una sola llamada (solo servidor) | `pruebas/08_guardar_aviso_whatsapp.sql` (3 OK) |
| 20260926000010 | etiquetas de chats (`etiquetas`, `chat_etiquetas`; solo admins; 7 de partida) | `pruebas/09_etiquetas_chats.sql` (4 OK) |

## Incidente 2026-09-26: historial de WhatsApp
Al reconectar WhatsApp, Meta mandó ~1.650 avisos por minuto; el buzón hacía 3 llamadas por aviso y la API (PostgREST) se colgó
(Admin y seguimiento caídos ~10 min; la web pública siguió bien). Se reinició el proyecto (Management API `POST /v1/projects/<ref>/restart`),
el buzón pasó a una sola llamada (`guardar_aviso_whatsapp`, 503 si la base no responde en 10 s → YCloud reintenta) y los avisos
respaldados sin convertir se procesaron con `mantenimiento/reprocesar_whatsapp_eventos.sql`.
