-- ============================================================
-- Fase 8 · Migración 10: etiquetas para los chats de WhatsApp (solo en la Admin)
-- ============================================================
-- Etiquetas propias de RINBŌ Admin (no se sincronizan con las del celular: Meta no las comparte).
-- Un chat se identifica por el número del cliente (whatsapp_mensajes.telefono). Solo administradores.
--
-- Cómo deshacer:
--   drop table rinbo.chat_etiquetas; drop table rinbo.etiquetas;
--   delete from rinbo.migraciones where version = '20260926000010';
-- ============================================================

begin;

create table rinbo.etiquetas (
  id        bigint generated always as identity primary key,
  nombre    text not null unique check (length(trim(nombre)) between 1 and 30),
  color     smallint not null default 1 check (color between 1 and 8),   -- 1..8 = colores fijos de la Admin
  orden     integer not null default 0,
  creado_en timestamptz not null default now()
);

create table rinbo.chat_etiquetas (
  telefono    text not null check (telefono ~ '^[0-9]{6,20}$'),
  etiqueta_id bigint not null references rinbo.etiquetas (id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (telefono, etiqueta_id)
);
create index on rinbo.chat_etiquetas (etiqueta_id);

alter table rinbo.etiquetas      enable row level security;
alter table rinbo.chat_etiquetas enable row level security;
create policy "solo admins" on rinbo.etiquetas      for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.chat_etiquetas for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
revoke all on rinbo.etiquetas, rinbo.chat_etiquetas from anon;
grant select, insert, update, delete on rinbo.etiquetas, rinbo.chat_etiquetas to authenticated;
grant all on rinbo.etiquetas, rinbo.chat_etiquetas to service_role;
grant usage, select on sequence rinbo.etiquetas_id_seq to authenticated, service_role;

-- Etiquetas de partida (se pueden renombrar, cambiar de color o borrar en la Admin)
insert into rinbo.etiquetas (nombre, color, orden) values
  ('Nuevo', 1, 1), ('Cotizando', 4, 2), ('Esperando pago', 2, 3), ('Pagado', 3, 4),
  ('Enviado', 7, 5), ('Frecuente', 5, 6), ('Postventa', 8, 7);

insert into rinbo.migraciones (version, nombre) values ('20260926000010', 'etiquetas_chats');

commit;
