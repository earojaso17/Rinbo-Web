-- Pruebas de las migraciones 2 y 3 (almacenamiento y funciones públicas). Igual que 01: dentro de una
-- transacción que se deshace; resultado una fila por prueba.

create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to anon, authenticated;
grant usage on sequence resultado_n_seq to anon, authenticated;

insert into rinbo.productos (id, nombre, precio_clp, stock, publicado) values
  ('PUB-1', 'Publicado', 1000, 'En Japón', true), ('OCULTO-1', 'No publicado', 2000, 'En Chile', false);
insert into rinbo.producto_fotos (producto_id, posicion, ruta, ruta_miniatura, ancho, alto) values ('PUB-1', 1, 'PUB-1/a-1200.webp', 'PUB-1/a-600.webp', 1200, 1500);
insert into rinbo.producto_fotos (producto_id, posicion, url_externa) values ('PUB-1', 2, 'https://drive.google.com/file/d/XYZ/view');
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl'),
                                          ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into rinbo.admins (user_id, email) values ('00000000-0000-4000-8000-00000000a001', 'admin-prueba@ejemplo.cl');

insert into resultado (prueba, ok, detalle)
select 'carpetas creadas con límites', count(*) = 2 and bool_and(file_size_limit = 1048576),
       string_agg(id || case when public then ' (pública)' else ' (privada)' end, ', ' order by id)
  from storage.buckets where id in ('productos', 'evidencias');

-- Visitante
set local role anon;
do $$ declare c json; u json; begin
  c := public.catalogo();
  insert into resultado (prueba, ok, detalle) values ('catálogo público: solo publicados', json_array_length(c) = 1 and c -> 0 ->> 'id' = 'PUB-1', json_array_length(c) || ' producto(s)');
  insert into resultado (prueba, ok, detalle) values ('fotos del bucket y de Drive', (c -> 0 -> 'fotos' -> 0 ->> 'g') like 'https://%/storage/v1/object/public/productos/PUB-1/a-1200.webp' and (c -> 0 -> 'fotos' -> 1 ->> 'url') like 'https://drive.google.com/%', c -> 0 -> 'fotos' ->> 0);
  insert into resultado (prueba, ok, detalle) values ('producto no publicado = vacío', public.producto('OCULTO-1') is null, 'null');
  insert into resultado (prueba, ok, detalle) values ('catálogo no muestra datos internos', (c -> 0) ->> 'orden' is null and (c -> 0) ->> 'publicado' is null, null);
  begin u := rinbo.uso_almacenamiento(); insert into resultado (prueba, ok, detalle) values ('anon no ve el uso de espacio', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('anon no ve el uso de espacio', true, sqlerrm); end;
  begin insert into storage.objects (bucket_id, name) values ('productos', 'hack.webp'); insert into resultado (prueba, ok, detalle) values ('anon no sube fotos', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('anon no sube fotos', true, sqlerrm); end;
end $$;
reset role;

-- Usuario con sesión que no es admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare u json; begin
  begin u := rinbo.uso_almacenamiento(); insert into resultado (prueba, ok, detalle) values ('usuario común no ve el uso de espacio', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('usuario común no ve el uso de espacio', true, sqlerrm); end;
  begin insert into storage.objects (bucket_id, name) values ('evidencias', 'x.webp'); insert into resultado (prueba, ok, detalle) values ('usuario común no sube evidencias', false, 'pudo');
  exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('usuario común no sube evidencias', true, sqlerrm); end;
end $$;
reset role;

-- Administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$ declare u json; n int; begin
  insert into storage.objects (bucket_id, name, metadata) values ('productos', 'PUB-1/a-1200.webp', '{"size": 150000}'), ('productos', 'viejo/foto.webp', '{"size": 90000}');
  insert into resultado (prueba, ok, detalle) values ('admin sube fotos', true, '2 archivos');
  select count(*) into n from rinbo.archivos_huerfanos();
  insert into resultado (prueba, ok, detalle) values ('detecta fotos que nadie usa', n = 1, n || ' huérfano(s)');
  u := rinbo.uso_almacenamiento();
  insert into resultado (prueba, ok, detalle) values ('admin ve el uso de espacio', (u -> 'archivos' ->> 'bytes')::bigint >= 240000 and json_array_length(u -> 'carpetas') >= 2, u::text);
end $$;
reset role;

select prueba, ok, detalle from resultado order by n;
