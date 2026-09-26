-- Pruebas de la migración 10 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare e bigint; n int; begin
  select count(*) into n from rinbo.etiquetas;
  insert into resultado (prueba, ok, detalle) values ('7 etiquetas de partida', n = 7, n::text);
  insert into rinbo.etiquetas (nombre, color) values ('VIP', 6) returning id into e;
  insert into rinbo.chat_etiquetas (telefono, etiqueta_id) values ('56911112222', e);
  begin insert into rinbo.chat_etiquetas (telefono, etiqueta_id) values ('56911112222', e);
    insert into resultado (prueba, ok, detalle) values ('no repite etiqueta en un chat', false, 'aceptó');
  exception when unique_violation then insert into resultado (prueba, ok, detalle) values ('no repite etiqueta en un chat', true, 'rechazó'); end;
  delete from rinbo.etiquetas where id = e;
  select count(*) into n from rinbo.chat_etiquetas where telefono = '56911112222';
  insert into resultado (prueba, ok, detalle) values ('borrar etiqueta la quita de los chats', n = 0, n::text);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.etiquetas;
  insert into resultado (prueba, ok, detalle) values ('no admin no ve etiquetas', n = 0, n::text);
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
