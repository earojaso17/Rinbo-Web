-- Pruebas de la migración 11 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare a bigint; b bigint; f bigint; n int; t text; begin
  select string_agg(nombre, ',' order by orden) into t from rinbo.etiquetas where es_etapa;
  insert into resultado (prueba, ok, detalle) values ('5 etapas en orden', t = 'Pendiente cotizar,Cotización enviada,Posible cliente,Pago recibido,Producto enviado', t);
  select string_agg(nombre, ',' order by orden) into t from rinbo.etiquetas where not es_etapa;
  insert into resultado (prueba, ok, detalle) values ('quedan Frecuente y Postventa libres', t = 'Frecuente,Postventa', t);
  select id into a from rinbo.etiquetas where nombre = 'Pendiente cotizar';
  select id into b from rinbo.etiquetas where nombre = 'Pago recibido';
  select id into f from rinbo.etiquetas where nombre = 'Frecuente';
  insert into rinbo.chat_etiquetas (telefono, etiqueta_id) values ('56911112222', a), ('56911112222', f);
  insert into rinbo.chat_etiquetas (telefono, etiqueta_id) values ('56911112222', b);
  select string_agg(e.nombre, ',' order by e.nombre) into t from rinbo.chat_etiquetas c join rinbo.etiquetas e on e.id = c.etiqueta_id where c.telefono = '56911112222';
  insert into resultado (prueba, ok, detalle) values ('una sola etapa; la libre se mantiene', t = 'Frecuente,Pago recibido', t);
  select string_agg(etapa, ' → ' order by id) into t from rinbo.chat_etapas_historial where telefono = '56911112222';
  insert into resultado (prueba, ok, detalle) values ('historial de etapas (sin libres)', t = 'Pendiente cotizar → Pago recibido', t);
  delete from rinbo.etiquetas where id = b;
  select count(*) into n from rinbo.chat_etapas_historial where telefono = '56911112222';
  insert into resultado (prueba, ok, detalle) values ('borrar la etapa no borra el historial', n = 2, n::text);
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
