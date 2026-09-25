-- Pruebas de seguridad del esquema rinbo. Se corren DENTRO de una transacción que termina en rollback
-- (no dejan nada en la base). Uso: migración (sin su "commit") + este archivo + "rollback".
-- Resultado: una fila por prueba con ok = true/false.

create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to anon, authenticated;
grant usage on sequence resultado_n_seq to anon, authenticated;

-- Datos de prueba (como dueño de la base)
insert into rinbo.productos (id, nombre, precio_clp, stock, publicado) values ('PRUEBA-1', 'Producto de prueba', 1000, 'En Japón', true);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'),
                                          ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

-- 1) Visitante (anon): no puede leer ni escribir nada
set local role anon;
do $$ begin
  begin perform 1 from rinbo.productos; insert into resultado (prueba, ok, detalle) values ('anon no lee productos', false, 'pudo leer');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('anon no lee productos', true, sqlerrm); end;
  begin perform rinbo.es_admin(); insert into resultado (prueba, ok, detalle) values ('anon no usa funciones de rinbo', false, 'pudo ejecutar');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('anon no usa funciones de rinbo', true, sqlerrm); end;
end $$;
reset role;

-- 2) Usuario con sesión pero que NO es admin: no ve filas y no puede escribir
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from rinbo.productos;
  insert into resultado (prueba, ok, detalle) values ('usuario común no ve productos', n = 0, n || ' filas visibles');
  begin insert into rinbo.productos (id, nombre) values ('HACK', 'x'); insert into resultado (prueba, ok, detalle) values ('usuario común no crea productos', false, 'pudo insertar');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('usuario común no crea productos', true, sqlerrm); end;
  begin insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000b002', 'x'); insert into resultado (prueba, ok, detalle) values ('usuario común no se hace admin', false, 'pudo insertar');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('usuario común no se hace admin', true, sqlerrm); end;
end $$;
reset role;

-- 3) Administrador: ve y escribe; pedidos con código, código secreto, etapas y saldo automáticos
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; c rinbo.clientes; p rinbo.pedidos; r rinbo.pedidos_resumen; begin
  select count(*) into n from rinbo.productos;
  insert into resultado (prueba, ok, detalle) values ('admin ve productos', n = 1, n || ' filas');
  insert into rinbo.clientes (nombre, whatsapp) values ('Cliente Prueba', '+56 9 1234 5678') returning * into c;
  insert into rinbo.pedidos (cliente_id, total_clp) values (c.id, 50000) returning * into p;
  insert into resultado (prueba, ok, detalle) values ('pedido recibe código y código secreto', p.codigo ~ '^R\d{5}$' and p.codigo_seguimiento ~ '^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$', p.codigo || ' · ' || p.codigo_seguimiento);
  insert into rinbo.pedido_etapas (pedido_id, etapa) values (p.id, 'Comprado en Japón'), (p.id, 'En Aduana');
  select * into p from rinbo.pedidos where id = p.id;
  insert into resultado (prueba, ok, detalle) values ('etapa actual = la más avanzada', p.etapa = 'En Aduana', p.etapa::text);
  delete from rinbo.pedido_etapas where pedido_id = p.id and etapa = 'En Aduana';
  select * into p from rinbo.pedidos where id = p.id;
  insert into resultado (prueba, ok, detalle) values ('borrar etapa recalcula', p.etapa = 'Comprado en Japón', p.etapa::text);
  insert into rinbo.pagos (pedido_id, monto_clp, medio) values (p.id, 20000, 'Transferencia');
  select * into r from rinbo.pedidos_resumen where id = p.id;
  insert into resultado (prueba, ok, detalle) values ('saldo calculado', r.abonado_clp = 20000 and r.saldo_clp = 30000, 'abonado ' || r.abonado_clp || ' · saldo ' || r.saldo_clp);
  begin insert into rinbo.productos (id, nombre, stock) values ('MAL-1', 'x', 'Agotado'); insert into resultado (prueba, ok, detalle) values ('stock solo acepta valores válidos', false, 'aceptó "Agotado"');
  exception when check_violation then insert into resultado (prueba, ok, detalle) values ('stock solo acepta valores válidos', true, 'rechazó "Agotado"'); end;
  begin insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000b002', 'x'); insert into resultado (prueba, ok, detalle) values ('admin no agrega admins por la API', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('admin no agrega admins por la API', true, sqlerrm); end;
end $$;
reset role;

-- 4) Revisión general
insert into resultado (prueba, ok, detalle)
select 'todas las tablas tienen RLS', bool_and(c.relrowsecurity), string_agg(c.relname, ', ') filter (where not c.relrowsecurity)
  from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'rinbo' and c.relkind = 'r';
insert into resultado (prueba, ok, detalle)
select 'anon sin permisos en tablas', not bool_or(has_table_privilege('anon', c.oid, 'select,insert,update,delete')), null
  from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'rinbo' and c.relkind in ('r', 'v');
insert into resultado (prueba, ok, detalle)
select 'funciones de rinbo no abiertas a todos', not bool_or(has_function_privilege('anon', p.oid, 'execute')), null
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'rinbo';

select prueba, ok, detalle from resultado order by n;
