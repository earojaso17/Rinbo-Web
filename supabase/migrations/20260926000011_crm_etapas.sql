-- ============================================================
-- Fase 8 · Migración 11: etapas del CRM para los chats (una a la vez, con historial)
-- ============================================================
-- Las etiquetas pasan a ser de dos tipos:
--   · etapa del CRM (es_etapa = true): un chat tiene UNA sola; al poner otra, la anterior se quita sola.
--   · etiqueta libre (es_etapa = false): se pueden poner varias.
-- Cada cambio de etapa queda en rinbo.chat_etapas_historial (qué etapa y cuándo), para verlo en la ficha del cliente.
-- El cliente se une a su chat por el número: clientes.whatsapp = chat_etiquetas.telefono.
--
-- Cómo deshacer:
--   drop trigger chat_etiquetas_etapa_unica on rinbo.chat_etiquetas; drop trigger chat_etiquetas_etapa_historial on rinbo.chat_etiquetas;
--   drop function rinbo.etapa_unica(); drop function rinbo.registrar_etapa(); drop table rinbo.chat_etapas_historial;
--   alter table rinbo.etiquetas drop column es_etapa;
--   delete from rinbo.migraciones where version = '20260926000011';
-- ============================================================

begin;

alter table rinbo.etiquetas add column es_etapa boolean not null default false;

-- Etapas de partida (reemplazan a las etiquetas de partida sin usar; Frecuente y Postventa quedan como libres)
delete from rinbo.etiquetas e
 where e.nombre in ('Nuevo', 'Cotizando', 'Esperando pago', 'Pagado', 'Enviado')
   and not exists (select 1 from rinbo.chat_etiquetas c where c.etiqueta_id = e.id);
update rinbo.etiquetas set orden = orden + 10 where not es_etapa;
insert into rinbo.etiquetas (nombre, color, orden, es_etapa) values
  ('Pendiente cotizar', 4, 1, true), ('Cotización enviada', 1, 2, true), ('Posible cliente', 5, 3, true),
  ('Pago recibido', 3, 4, true), ('Producto enviado', 7, 5, true)
on conflict (nombre) do update set es_etapa = true, orden = excluded.orden;

-- Historial de etapas por número
create table rinbo.chat_etapas_historial (
  id          bigint generated always as identity primary key,
  telefono    text not null check (telefono ~ '^[0-9]{6,20}$'),
  etiqueta_id bigint references rinbo.etiquetas (id) on delete set null,
  etapa       text not null,              -- nombre al momento del cambio (queda aunque se renombre o borre)
  cambiado_en timestamptz not null default now()
);
create index on rinbo.chat_etapas_historial (telefono, cambiado_en desc);
alter table rinbo.chat_etapas_historial enable row level security;
create policy "solo admins" on rinbo.chat_etapas_historial for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
revoke all on rinbo.chat_etapas_historial from anon;
grant select, delete on rinbo.chat_etapas_historial to authenticated;
grant all on rinbo.chat_etapas_historial to service_role;

-- Una sola etapa por chat: al poner una etapa, se quitan las otras etapas de ese número
create function rinbo.etapa_unica() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select es_etapa from rinbo.etiquetas where id = new.etiqueta_id) then
    delete from rinbo.chat_etiquetas c using rinbo.etiquetas e
     where c.etiqueta_id = e.id and e.es_etapa and c.telefono = new.telefono and c.etiqueta_id <> new.etiqueta_id;
  end if;
  return new;
end $$;
create trigger chat_etiquetas_etapa_unica before insert on rinbo.chat_etiquetas
  for each row execute function rinbo.etapa_unica();

-- Registrar cada etapa puesta
create function rinbo.registrar_etapa() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into rinbo.chat_etapas_historial (telefono, etiqueta_id, etapa)
  select new.telefono, e.id, e.nombre from rinbo.etiquetas e where e.id = new.etiqueta_id and e.es_etapa;
  return null;
end $$;
create trigger chat_etiquetas_etapa_historial after insert on rinbo.chat_etiquetas
  for each row execute function rinbo.registrar_etapa();
revoke execute on function rinbo.etapa_unica(), rinbo.registrar_etapa() from public, anon, authenticated;

insert into rinbo.migraciones (version, nombre) values ('20260926000011', 'crm_etapas');

commit;
