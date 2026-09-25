-- Pruebas de la migración 5 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'), ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

-- Admin crea cliente y pedido importado (R00950) y uno nuevo (debe salir R00951)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare c uuid; p1 uuid; p2 text; begin
  insert into rinbo.clientes (nombre, whatsapp) values ('Cliente Prueba', '56911112222') returning id into c;
  insert into rinbo.pedidos (codigo, cliente_id, total_clp, comentarios_generales, notas_internas)
    values ('R00950', c, 50000, 'Llega en marzo', 'SECRETO interno') returning id into p1;
  insert into rinbo.pedidos (cliente_id) values (c) returning codigo into p2;
  insert into resultado (prueba, ok, detalle) values ('contador salta después de importar', p2 = 'R00951', p2);
  insert into rinbo.pedido_etapas (pedido_id, etapa, fecha, comentario) values (p1, 'Encargo Confirmado', '2026-09-01', 'ok'),
    (p1, 'Comprado en Japón', '2026-09-05', 'comprado'), (p1, 'En Bodega Japón', '2026-09-10', 'nota interna');
  update rinbo.pedido_etapas set visible_cliente = false where comentario = 'nota interna';
  insert into rinbo.pagos (pedido_id, monto_clp) values (p1, 20000);
  insert into rinbo.evidencias (pedido_id, ruta) values (p1, 'x/foto.webp');
  insert into rinbo.evidencias (pedido_id, url_externa) values (p1, 'https://drive.google.com/file/d/abc/view');
  insert into rinbo.evidencias (pedido_id, ruta, visible_cliente) values (p1, 'x/oculta.webp', false);
  begin insert into rinbo.evidencias (pedido_id) values (p1);
    insert into resultado (prueba, ok, detalle) values ('evidencia sin archivo ni link se rechaza', false, 'aceptó');
  exception when check_violation then insert into resultado (prueba, ok, detalle) values ('evidencia sin archivo ni link se rechaza', true, 'rechazó'); end;
  insert into resultado (prueba, ok, detalle) select 'resumen con cliente y saldo', cliente_nombre = 'Cliente Prueba' and saldo_clp = 30000 and etapa = 'En Bodega Japón', cliente_nombre || ' ' || saldo_clp || ' ' || etapa from rinbo.pedidos_resumen where codigo = 'R00950';
end $$;

-- Admin (authenticated) no puede usar la función pública del servidor
do $$ begin perform rinbo.seguimiento_publico('x', 'y');
  insert into resultado (prueba, ok, detalle) values ('admin no llama seguimiento_publico', false, 'pudo');
exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('admin no llama seguimiento_publico', true, 'bloqueado'); end $$;
reset role;

-- Visitante (anon) tampoco
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin perform rinbo.seguimiento_publico('x', 'y');
  insert into resultado (prueba, ok, detalle) values ('visitante no llama seguimiento_publico', false, 'pudo');
exception when insufficient_privilege or invalid_schema_name then insert into resultado (prueba, ok, detalle) values ('visitante no llama seguimiento_publico', true, 'bloqueado'); end $$;
reset role;

-- Servidor (service_role) con el código secreto
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ declare cod text; j json; t text; begin
  select codigo_seguimiento into cod from rinbo.pedidos where codigo = 'R00950';
  j := rinbo.seguimiento_publico(lower(replace(cod, '-', ' ')), 'ip-a');
  t := j::text;
  insert into resultado (prueba, ok, detalle) values ('encuentra con código en minúsculas y sin guion', j->>'codigo' = 'R00950', j->>'codigo');
  insert into resultado (prueba, ok, detalle) values ('etapa y cuenta', j->>'etapa' = 'En Bodega Japón' and (j->>'abonado_clp')::int = 20000 and (j->>'total_clp')::int = 50000, j->>'etapa');
  insert into resultado (prueba, ok, detalle) values ('solo etapas visibles', json_array_length(j->'etapas') = 2, json_array_length(j->'etapas')::text);
  insert into resultado (prueba, ok, detalle) values ('solo evidencias visibles', json_array_length(j->'evidencias') = 2, json_array_length(j->'evidencias')::text);
  insert into resultado (prueba, ok, detalle) values ('no muestra notas internas ni cliente', t not like '%SECRETO%' and t not like '%Cliente Prueba%' and t not like '%5691111%' and t not like '%nota interna%', left(t, 60));
  j := rinbo.seguimiento_publico('R00950', 'ip-b');
  insert into resultado (prueba, ok, detalle) values ('código antiguo R00950 no sirve', j->>'error' = 'no_encontrado', j::text);
  for i in 1..10 loop j := rinbo.seguimiento_publico('AAAAA-BBBBB', 'ip-c'); end loop;
  j := rinbo.seguimiento_publico(cod, 'ip-c');
  insert into resultado (prueba, ok, detalle) values ('10 errores bloquean esa IP', j->>'error' = 'demasiados', j::text);
  j := rinbo.seguimiento_publico(cod, 'ip-d');
  insert into resultado (prueba, ok, detalle) values ('otra IP sigue funcionando', j->>'codigo' = 'R00950', j->>'codigo');
end $$;
reset role;

-- Usuario común (no admin) no ve pedidos ni consultas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.pedidos_resumen;
  insert into resultado (prueba, ok, detalle) values ('no admin no ve pedidos', n = 0, n::text);
  begin perform count(*) from rinbo.consultas_seguimiento;
    insert into resultado (prueba, ok, detalle) values ('consultas_seguimiento cerrada', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('consultas_seguimiento cerrada', true, 'bloqueado'); end;
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
