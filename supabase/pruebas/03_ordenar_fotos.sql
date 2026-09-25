-- Pruebas de la migración 4 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated;
grant usage on sequence resultado_n_seq to authenticated;
insert into rinbo.productos (id, nombre) values ('ORD-1', 'Orden');
insert into rinbo.producto_fotos (producto_id, posicion, url_externa) values ('ORD-1', 1, 'a'), ('ORD-1', 2, 'b'), ('ORD-1', 3, 'c');
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare ids bigint[]; orden text; begin
  perform rinbo.ordenar_fotos('ORD-1', array[3, 2, 1]::bigint[]);  -- ids inventados; no debería cambiar nada (no ve filas)
end $$;
reset role;
insert into resultado (prueba, ok, detalle) select 'usuario común no reordena', string_agg(url_externa, '' order by posicion) = 'abc', string_agg(url_externa, '' order by posicion) from rinbo.producto_fotos where producto_id = 'ORD-1';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare ids bigint[]; orden text; begin
  select array_agg(id order by url_externa desc) into ids from rinbo.producto_fotos where producto_id = 'ORD-1';
  perform rinbo.ordenar_fotos('ORD-1', ids);
  select string_agg(url_externa, '' order by posicion) into orden from rinbo.producto_fotos where producto_id = 'ORD-1';
  insert into resultado (prueba, ok, detalle) values ('admin invierte el orden', orden = 'cba', orden);
  begin insert into rinbo.producto_fotos (producto_id, posicion, url_externa) values ('ORD-1', 1, 'dup');
    insert into resultado (prueba, ok, detalle) values ('sigue sin permitir posiciones repetidas', false, 'aceptó');
  exception when unique_violation then insert into resultado (prueba, ok, detalle) values ('sigue sin permitir posiciones repetidas', true, 'rechazó'); end;
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
