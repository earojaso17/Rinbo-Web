-- Pruebas de la migración 7 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

-- El servidor guarda (como la Edge Function)
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into rinbo.whatsapp_mensajes (wamid, telefono, nombre_perfil, direccion, texto, enviado_en) values
  ('w1', '56911112222', 'Cami', 'entrante', 'Hola, ¿tienen la polera?', now() - interval '2 hours'),
  ('w2', '56911112222', null, 'saliente', 'Sí, en talla M', now() - interval '1 hour'),
  ('w3', '56933334444', 'Pedro', 'entrante', 'Precio?', now());
insert into rinbo.whatsapp_mensajes (wamid, telefono, direccion, texto, enviado_en) values ('w1', '56911112222', 'entrante', 'repetido', now())
  on conflict (wamid) do nothing;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; r record; begin
  insert into rinbo.clientes (nombre, whatsapp) values ('Camila', '56911112222');
  select count(*) into n from rinbo.whatsapp_mensajes;
  insert into resultado (prueba, ok, detalle) values ('admin ve mensajes (sin duplicar)', n = 3, n::text);
  select * into r from rinbo.whatsapp_conversaciones where telefono = '56911112222';
  insert into resultado (prueba, ok, detalle) values ('conversación: último, cantidad y cliente', r.ultimo_texto = 'Sí, en talla M' and r.mensajes = 2 and r.entrantes = 1 and r.cliente_nombre = 'Camila', r.ultimo_texto || ' ' || r.mensajes || ' ' || coalesce(r.cliente_nombre, '-'));
  begin insert into rinbo.whatsapp_mensajes (wamid, telefono, direccion, enviado_en) values ('x', '569', 'entrante', now());
    insert into resultado (prueba, ok, detalle) values ('admin no escribe mensajes', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('admin no escribe mensajes', true, 'bloqueado'); end;
  begin update rinbo.whatsapp_mensajes set texto = 'cambiado';
    insert into resultado (prueba, ok, detalle) values ('admin no cambia mensajes', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('admin no cambia mensajes', true, 'bloqueado'); end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; m int; begin
  select count(*) into n from rinbo.whatsapp_mensajes;
  select count(*) into m from rinbo.whatsapp_conversaciones;
  insert into resultado (prueba, ok, detalle) values ('no admin no ve mensajes', n = 0 and m = 0, n || '/' || m);
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin perform count(*) from rinbo.whatsapp_mensajes;
  insert into resultado (prueba, ok, detalle) values ('visitante bloqueado', false, 'pudo');
exception when insufficient_privilege or invalid_schema_name then insert into resultado (prueba, ok, detalle) values ('visitante bloqueado', true, 'bloqueado'); end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
