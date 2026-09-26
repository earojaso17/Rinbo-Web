-- ============================================================
-- Fase 8 · Migración 12: estado de cada chat (oculto y leído), guardado en la base
-- ============================================================
-- oculto:      null = automático (se oculta si el cliente nunca escribió: difusiones y avisos de WhatsApp);
--              true = ocultado a mano; false = mostrado a mano.
-- leido_hasta: fecha del último mensaje que el dueño ya vio (lo más nuevo que eso cuenta como "sin leer").
-- no_leido:    marcado a mano como no leído (aunque ya se haya visto).
-- Queda en la base (no en el navegador) para verse igual en el celular y en el computador. Solo administradores.
--
-- Cómo deshacer:
--   drop table rinbo.chat_estado;
--   delete from rinbo.migraciones where version = '20260926000012';
-- ============================================================

begin;

create table rinbo.chat_estado (
  telefono       text primary key check (telefono ~ '^[0-9]{6,20}$'),
  oculto         boolean,
  leido_hasta    timestamptz,
  no_leido       boolean not null default false,
  actualizado_en timestamptz not null default now()
);
create trigger chat_estado_actualizado before update on rinbo.chat_estado
  for each row execute function rinbo.tocar_actualizado();

alter table rinbo.chat_estado enable row level security;
create policy "solo admins" on rinbo.chat_estado for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
revoke all on rinbo.chat_estado from anon;
grant select, insert, update, delete on rinbo.chat_estado to authenticated;
grant all on rinbo.chat_estado to service_role;

insert into rinbo.migraciones (version, nombre) values ('20260926000012', 'chat_estado');

commit;
