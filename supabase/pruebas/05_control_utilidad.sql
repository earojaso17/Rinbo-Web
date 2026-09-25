-- Pruebas de la migración 6 (dentro de una transacción que se deshace).
-- Ojo: crea un pedido, así que el contador de códigos avanza; después dejarlo como estaba.
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare u int; begin
  insert into rinbo.pedidos (codigo, total_clp, costo_clp, impuestos_clp) values ('ZUTIL', 100000, 60000, 15000);
  select utilidad_clp into u from rinbo.pedidos_resumen where codigo = 'ZUTIL';
  insert into resultado (prueba, ok, detalle) values ('utilidad = venta - costo - impuestos', u = 25000, u::text);
  begin update rinbo.pedidos set costo_clp = -1 where codigo = 'ZUTIL';
    insert into resultado (prueba, ok, detalle) values ('costo negativo se rechaza', false, 'aceptó');
  exception when check_violation then insert into resultado (prueba, ok, detalle) values ('costo negativo se rechaza', true, 'rechazó'); end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ declare cod text; t text; begin
  select codigo_seguimiento into cod from rinbo.pedidos where codigo = 'ZUTIL';
  t := rinbo.seguimiento_publico(cod, 'ip-x')::text;
  insert into resultado (prueba, ok, detalle) values ('seguimiento no muestra costo, impuestos ni utilidad', t like '%ZUTIL%' and t not like '%60000%' and t not like '%15000%' and t not like '%costo%' and t not like '%utilidad%', left(t, 60));
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.pedidos_resumen;
  insert into resultado (prueba, ok, detalle) values ('no admin no ve la vista', n = 0, n::text);
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
