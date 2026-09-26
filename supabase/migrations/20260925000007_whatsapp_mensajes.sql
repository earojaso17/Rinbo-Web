-- ============================================================
-- Fase 8 · Migración 7: bandeja de WhatsApp (solo lectura)
-- ============================================================
-- Los mensajes del número de la tienda llegan desde YCloud (coexistencia con la app WhatsApp Business)
-- a la Edge Function "whatsapp-webhook", que los guarda aquí con la llave de servidor.
-- La Admin solo los LEE (y puede borrarlos); nadie más tiene acceso.
-- El cliente se reconoce por su número: clientes.whatsapp = whatsapp_mensajes.telefono (solo dígitos).
--
-- Cómo deshacer:
--   drop view rinbo.whatsapp_conversaciones; drop table rinbo.whatsapp_mensajes;
--   delete from rinbo.migraciones where version = '20260925000007';
-- ============================================================

begin;

create table rinbo.whatsapp_mensajes (
  id            bigint generated always as identity primary key,
  wamid         text not null unique,                 -- id del mensaje en WhatsApp (evita duplicados)
  telefono      text not null check (telefono ~ '^[0-9]{6,20}$'),   -- el cliente (no la tienda)
  nombre_perfil text,                                 -- nombre que el cliente tiene en WhatsApp
  direccion     text not null check (direccion in ('entrante', 'saliente')),
  tipo          text not null default 'text',         -- text, image, audio, sticker…
  texto         text,
  enviado_en    timestamptz not null,
  evento        text,                                 -- tipo de aviso de YCloud (para revisar)
  crudo         jsonb,                                -- aviso completo, por si hay que reprocesar
  creado_en     timestamptz not null default now()
);
create index on rinbo.whatsapp_mensajes (telefono, enviado_en desc);
create index on rinbo.whatsapp_mensajes (enviado_en desc);

alter table rinbo.whatsapp_mensajes enable row level security;
create policy "admins leen" on rinbo.whatsapp_mensajes for select to authenticated using (rinbo.es_admin());
create policy "admins borran" on rinbo.whatsapp_mensajes for delete to authenticated using (rinbo.es_admin());
revoke all on rinbo.whatsapp_mensajes from authenticated, anon;
grant select, delete on rinbo.whatsapp_mensajes to authenticated;
grant all on rinbo.whatsapp_mensajes to service_role;
grant usage, select on sequence rinbo.whatsapp_mensajes_id_seq to service_role;

-- Una fila por chat: último mensaje, cantidad y el cliente de la Admin con ese número (si existe)
create view rinbo.whatsapp_conversaciones with (security_invoker = true) as
select u.telefono, coalesce(u.nombre_perfil, t.nombre) as nombre_perfil, u.texto as ultimo_texto, u.tipo as ultimo_tipo, u.direccion as ultima_direccion,
       u.enviado_en as ultimo_en, t.mensajes, t.entrantes,
       c.id as cliente_id, c.nombre as cliente_nombre
  from (select distinct on (telefono) * from rinbo.whatsapp_mensajes order by telefono, enviado_en desc, id desc) u
  join (select telefono, count(*)::int as mensajes, count(*) filter (where direccion = 'entrante')::int as entrantes,
               max(nombre_perfil) filter (where nombre_perfil is not null) as nombre
          from rinbo.whatsapp_mensajes group by telefono) t on t.telefono = u.telefono
  left join lateral (select id, nombre from rinbo.clientes where whatsapp = u.telefono order by creado_en limit 1) c on true;
grant select on rinbo.whatsapp_conversaciones to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000007', 'whatsapp_mensajes');

commit;
