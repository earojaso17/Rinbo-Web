-- ============================================================
-- Fases 5 y 6 · Migración 5: pedidos en la Admin y seguimiento público con código secreto
-- ============================================================
-- 1) Evidencias: pueden ser un archivo del bucket privado "evidencias" o (pedidos importados de SegPublica)
--    un link de Google Drive que ya era público en la planilla.
-- 2) Al crear un pedido con código "R00123" (importado), el contador de códigos salta para no repetirlo.
-- 3) rinbo.seguimiento_publico(código secreto, ip): lo que ve el cliente. Solo lo puede llamar el servidor
--    (service_role, desde la Edge Function "seguimiento"), nunca un visitante directo. Limita intentos por IP.
-- 4) pedidos_resumen: agrega nombre y WhatsApp del cliente para la lista de la Admin.
--
-- Cómo deshacer:
--   drop function rinbo.seguimiento_publico(text, text); drop table rinbo.consultas_seguimiento;
--   drop trigger pedidos_codigo_contador on rinbo.pedidos; drop function rinbo.ajustar_contador_pedidos();
--   (evidencias y la vista pueden quedar como están)
--   delete from rinbo.migraciones where version = '20260925000005';
-- ============================================================

begin;

-- ---------- 1) Evidencias con link externo ----------
alter table rinbo.evidencias alter column ruta drop not null;
alter table rinbo.evidencias add column url_externa text;
alter table rinbo.evidencias add constraint evidencias_archivo_o_link check (ruta is not null or url_externa is not null);

-- ---------- 2) Contador de códigos R00001… ----------
create function rinbo.ajustar_contador_pedidos() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  n bigint;
  actual bigint;
begin
  if new.codigo ~ '^R[0-9]{1,15}$' then
    n := substr(new.codigo, 2)::bigint;
    select case when is_called then last_value else last_value - 1 end into actual from rinbo.pedidos_codigo_seq;
    if n > actual then perform setval('rinbo.pedidos_codigo_seq', n, true); end if;
  end if;
  return null;
end $$;
revoke execute on function rinbo.ajustar_contador_pedidos() from public;
create trigger pedidos_codigo_contador after insert or update of codigo on rinbo.pedidos
  for each row execute function rinbo.ajustar_contador_pedidos();

-- ---------- 3) Seguimiento público ----------
-- Registro de consultas (para frenar a quien pruebe códigos al azar). Se borra solo después de 2 días.
create table rinbo.consultas_seguimiento (
  id         bigint generated always as identity primary key,
  ip         text not null,        -- huella (hash) de la IP, no la IP
  encontrado boolean not null,
  creado_en  timestamptz not null default now()
);
create index on rinbo.consultas_seguimiento (ip, creado_en);
alter table rinbo.consultas_seguimiento enable row level security;   -- sin políticas: nadie de la API
revoke all on rinbo.consultas_seguimiento from authenticated, anon;
grant all on rinbo.consultas_seguimiento to service_role;

create function rinbo.seguimiento_publico(p_codigo text, p_ip text) returns json
language plpgsql volatile security definer set search_path = ''
as $$
declare
  limpio text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  cod text;
  p rinbo.pedidos;
  fallidos int;
  abonado int;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('request.jwt.claims', true), '') not in ('', '{}') then
    raise exception 'Solo el servidor' using errcode = '42501';
  end if;

  -- Máximo 10 códigos equivocados cada 15 minutos por IP
  select count(*) into fallidos from rinbo.consultas_seguimiento
   where ip = coalesce(p_ip, '') and not encontrado and creado_en > now() - interval '15 minutes';
  if fallidos >= 10 then
    return json_build_object('error', 'demasiados');
  end if;

  if length(limpio) = 10 then
    cod := substr(limpio, 1, 5) || '-' || substr(limpio, 6);
    select * into p from rinbo.pedidos where codigo_seguimiento = cod;
  end if;

  delete from rinbo.consultas_seguimiento where creado_en < now() - interval '2 days';
  insert into rinbo.consultas_seguimiento (ip, encontrado) values (coalesce(p_ip, ''), p.id is not null);

  if p.id is null then
    return json_build_object('error', 'no_encontrado');
  end if;

  select coalesce(sum(monto_clp), 0) into abonado from rinbo.pagos where pedido_id = p.id;

  return json_build_object(
    'codigo', p.codigo,
    'etapa', p.etapa,
    'total_clp', p.total_clp,
    'abonado_clp', abonado,
    'comentarios_generales', p.comentarios_generales,
    'etapas', coalesce((select json_agg(json_build_object('etapa', e.etapa, 'fecha', e.fecha, 'comentario', e.comentario)
                                        order by e.etapa, e.fecha, e.id)
                          from rinbo.pedido_etapas e where e.pedido_id = p.id and e.visible_cliente), '[]'::json),
    'evidencias', coalesce((select json_agg(json_build_object('ruta', v.ruta, 'url', v.url_externa, 'descripcion', v.descripcion)
                                            order by v.creado_en, v.id)
                              from rinbo.evidencias v where v.pedido_id = p.id and v.visible_cliente), '[]'::json)
  );
end $$;
comment on function rinbo.seguimiento_publico(text, text) is 'Seguimiento para el cliente (solo vía Edge Function "seguimiento", con service_role).';
revoke execute on function rinbo.seguimiento_publico(text, text) from public, anon, authenticated;
grant execute on function rinbo.seguimiento_publico(text, text) to service_role;

-- ---------- 4) Resumen con datos del cliente ----------
create or replace view rinbo.pedidos_resumen with (security_invoker = true) as
select p.*,
       coalesce(sum(pg.monto_clp), 0)::integer               as abonado_clp,
       (p.total_clp - coalesce(sum(pg.monto_clp), 0))::integer as saldo_clp,
       c.nombre   as cliente_nombre,
       c.whatsapp as cliente_whatsapp
  from rinbo.pedidos p
  left join rinbo.pagos pg on pg.pedido_id = p.id
  left join rinbo.clientes c on c.id = p.cliente_id
 group by p.id, c.id;
grant select on rinbo.pedidos_resumen to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000005', 'pedidos_y_seguimiento');

commit;
