-- ============================================================
-- Fase 2 · Migración 2: carpetas de archivos (buckets) y control del almacenamiento
-- ============================================================
-- productos  → público (la web muestra las fotos). Solo administradores suben, cambian o borran.
-- evidencias → privado (fotos de pedidos). Solo administradores; el cliente las verá con links temporales (fase 6).
-- Límite por archivo 1 MB e imágenes solamente: la Admin comprime cada foto antes de subirla
-- (plan gratis de Supabase: 1 GB de archivos en total).
--
-- Cómo deshacer (mientras las carpetas estén vacías):
--   drop policy "admins suben/leen/cambian/borran …" on storage.objects;  (las 4 de abajo)
--   delete from storage.buckets where id in ('productos', 'evidencias');
--   drop function rinbo.uso_almacenamiento(); drop function rinbo.archivos_huerfanos(); drop function rinbo.exigir_admin();
--   delete from rinbo.migraciones where version = '20260925000002';
-- ============================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('productos',  'productos',  true,  1048576, array['image/webp', 'image/jpeg', 'image/png']),
  ('evidencias', 'evidencias', false, 1048576, array['image/webp', 'image/jpeg', 'image/png']);

-- Reglas sobre los archivos: solo administradores (rinbo.es_admin) en ambas carpetas.
-- (Las fotos de "productos" igual se pueden VER por su link público; eso no pasa por estas reglas.)
create policy "admins leen archivos" on storage.objects for select to authenticated
  using (bucket_id in ('productos', 'evidencias') and rinbo.es_admin());
create policy "admins suben archivos" on storage.objects for insert to authenticated
  with check (bucket_id in ('productos', 'evidencias') and rinbo.es_admin());
create policy "admins cambian archivos" on storage.objects for update to authenticated
  using (bucket_id in ('productos', 'evidencias') and rinbo.es_admin())
  with check (bucket_id in ('productos', 'evidencias') and rinbo.es_admin());
create policy "admins borran archivos" on storage.objects for delete to authenticated
  using (bucket_id in ('productos', 'evidencias') and rinbo.es_admin());

-- Corta si quien llama no es administrador. Se permite también el servidor (service_role) y la consola
-- de la base (sin sesión de la API). Ojo: dentro de funciones "security definer" current_user es el dueño,
-- por eso se mira la sesión (JWT) de quien llama y no current_user.
create function rinbo.exigir_admin() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if rinbo.es_admin() or coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('request.jwt.claims', true), '') in ('', '{}') then
    return;
  end if;
  raise exception 'Solo administradores' using errcode = '42501';
end $$;

-- Archivos subidos que ya ningún producto ni pedido usa (para que la Admin ofrezca borrarlos)
create function rinbo.archivos_huerfanos()
returns table (carpeta text, ruta text, bytes bigint, subido timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform rinbo.exigir_admin();
  return query
  select o.bucket_id::text, o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
    from storage.objects o
   where (o.bucket_id = 'productos'
          and not exists (select 1 from rinbo.producto_fotos f where o.name in (f.ruta, f.ruta_miniatura)))
      or (o.bucket_id = 'evidencias'
          and not exists (select 1 from rinbo.evidencias e where e.ruta = o.name))
   order by o.created_at;
end $$;

-- Cuánto se usa del plan gratis (base de datos 500 MB, archivos 1 GB)
create function rinbo.uso_almacenamiento() returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  limite_db  constant bigint := 500 * 1024 * 1024;
  limite_arc constant bigint := 1024 * 1024 * 1024;
  db bigint := pg_database_size(current_database());
  arc bigint;
  resultado json;
begin
  perform rinbo.exigir_admin();
  select coalesce(sum((metadata ->> 'size')::bigint), 0) into arc from storage.objects;
  select json_build_object(
    'base_datos', json_build_object('bytes', db, 'limite', limite_db, 'porcentaje', round(100.0 * db / limite_db, 1)),
    'archivos',   json_build_object('bytes', arc, 'limite', limite_arc, 'porcentaje', round(100.0 * arc / limite_arc, 1)),
    'carpetas',   coalesce((select json_agg(x order by x.carpeta) from (
                               select b.id as carpeta, count(o.id) as archivos, coalesce(sum((o.metadata ->> 'size')::bigint), 0) as bytes
                                 from storage.buckets b left join storage.objects o on o.bucket_id = b.id
                                group by b.id) x), '[]'::json),
    'huerfanos',  (select json_build_object('archivos', count(*), 'bytes', coalesce(sum(h.bytes), 0)) from rinbo.archivos_huerfanos() h),
    'tablas',     (select json_build_object('productos', (select count(*) from rinbo.productos),
                                            'clientes',  (select count(*) from rinbo.clientes),
                                            'pedidos',   (select count(*) from rinbo.pedidos)))
  ) into resultado;
  return resultado;
end $$;

revoke execute on function rinbo.exigir_admin(), rinbo.archivos_huerfanos(), rinbo.uso_almacenamiento() from public;
grant execute on function rinbo.exigir_admin() to authenticated, service_role;
grant execute on function rinbo.archivos_huerfanos(), rinbo.uso_almacenamiento() to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000002', 'almacenamiento');

commit;
