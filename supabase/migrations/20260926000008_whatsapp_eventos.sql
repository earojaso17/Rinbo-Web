-- ============================================================
-- Fase 8 · Migración 8: respaldo de cada aviso de WhatsApp (para no perder el historial)
-- ============================================================
-- La Edge Function "whatsapp-webhook" guarda aquí CADA aviso de YCloud tal como llega (firma verificada),
-- antes de convertirlo en mensajes. Si un aviso trae un formato inesperado (por ejemplo el historial que Meta
-- envía una sola vez al conectar), queda guardado y se puede reprocesar con rinbo.whatsapp_mensajes.
-- Solo el servidor escribe; los administradores pueden leer (para revisar).
--
-- Cómo deshacer:
--   drop table rinbo.whatsapp_eventos;
--   delete from rinbo.migraciones where version = '20260926000008';
-- ============================================================

begin;

create table rinbo.whatsapp_eventos (
  id          bigint generated always as identity primary key,
  evento_id   text unique,                 -- id del aviso de YCloud (evita guardar dos veces un reintento)
  tipo        text not null,               -- whatsapp.smb.history, whatsapp.inbound_message.received…
  mensajes    integer not null default 0,  -- cuántos mensajes se sacaron de este aviso
  crudo       jsonb not null,
  recibido_en timestamptz not null default now()
);
create index on rinbo.whatsapp_eventos (tipo, recibido_en desc);

alter table rinbo.whatsapp_eventos enable row level security;
create policy "admins leen" on rinbo.whatsapp_eventos for select to authenticated using (rinbo.es_admin());
revoke all on rinbo.whatsapp_eventos from authenticated, anon;
grant select on rinbo.whatsapp_eventos to authenticated;
grant all on rinbo.whatsapp_eventos to service_role;
grant usage, select on sequence rinbo.whatsapp_eventos_id_seq to service_role;

insert into rinbo.migraciones (version, nombre) values ('20260926000008', 'whatsapp_eventos');

commit;
