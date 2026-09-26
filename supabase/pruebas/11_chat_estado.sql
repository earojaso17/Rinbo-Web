-- Pruebas de la migración 12 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare r record; begin
  insert into rinbo.chat_estado (telefono, oculto) values ('56911112222', true)
    on conflict (telefono) do update set oculto = excluded.oculto;
  insert into rinbo.chat_estado (telefono, leido_hasta, no_leido) values ('56911112222', '2026-09-26T10:00:00Z', true)
    on conflict (telefono) do update set leido_hasta = excluded.leido_hasta, no_leido = excluded.no_leido;
  select * into r from rinbo.chat_estado where telefono = '56911112222';
  insert into resultado (prueba, ok, detalle) values ('guardar y combinar estado', r.oculto and r.no_leido and r.leido_hasta = '2026-09-26T10:00:00Z', r.oculto || ' ' || r.no_leido);
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.chat_estado;
  insert into resultado (prueba, ok, detalle) values ('no admin no ve estados', n = 0, n::text);
  begin insert into rinbo.chat_estado (telefono, oculto) values ('56933334444', true);
    insert into resultado (prueba, ok, detalle) values ('no admin no escribe', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('no admin no escribe', true, 'bloqueado'); end;
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
