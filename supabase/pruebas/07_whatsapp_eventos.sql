-- Pruebas de la migración 8 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into rinbo.whatsapp_eventos (evento_id, tipo, crudo) values ('e1', 'whatsapp.smb.history', '{"a":1}');
insert into rinbo.whatsapp_eventos (evento_id, tipo, crudo) values ('e1', 'whatsapp.smb.history', '{"a":2}') on conflict (evento_id) do nothing;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.whatsapp_eventos where evento_id = 'e1';
  insert into resultado (prueba, ok, detalle) values ('admin lee eventos (sin duplicar reintentos)', n = 1, n::text);
  begin insert into rinbo.whatsapp_eventos (tipo, crudo) values ('x', '{}');
    insert into resultado (prueba, ok, detalle) values ('admin no escribe eventos', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('admin no escribe eventos', true, 'bloqueado'); end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.whatsapp_eventos;
  insert into resultado (prueba, ok, detalle) values ('no admin no ve eventos', n = 0, n::text);
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
