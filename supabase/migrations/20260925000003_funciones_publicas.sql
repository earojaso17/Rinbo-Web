-- ============================================================
-- Fase 2 · Migración 3: funciones públicas del catálogo (la "ventanilla")
-- ============================================================
-- Son lo ÚNICO de la base que un visitante puede usar (rol anon), vía
--   POST https://mgxljvxjonopchpvmjkl.supabase.co/rest/v1/rpc/catalogo
--   POST https://mgxljvxjonopchpvmjkl.supabase.co/rest/v1/rpc/producto   {"p_id": "ROP-02607001"}
-- Devuelven solo productos publicados y solo las columnas que hoy ya muestra la web (mismos nombres
-- que la planilla), más las fotos. Se usarán en la fase 4, cuando la web lea el catálogo desde aquí.
--
-- Cómo deshacer:
--   drop function public.catalogo(); drop function public.producto(text); drop function rinbo.producto_json(rinbo.productos);
--   delete from rinbo.migraciones where version = '20260925000003';
-- ============================================================

begin;

-- Un producto en el formato de la web. Fotos: {m, g, w, h} si están en el bucket, {url} si aún son de Google Drive.
create function rinbo.producto_json(p rinbo.productos) returns json
language sql stable set search_path = ''
as $$
  select json_build_object(
    'id', p.id, 'nombre', p.nombre, 'categoria_principal', p.categoria_principal,
    'categoria_secundaria', p.categoria_secundaria, 'detalle', p.detalle, 'marca', p.marca,
    'opcion_1', p.opcion_1, 'opcion_2', p.opcion_2, 'descripcion', p.descripcion, 'estado', p.estado,
    'precio_clp', p.precio_clp, 'precio_oferta', p.precio_oferta, 'stock', p.stock,
    'destacado', p.destacado, 'tabla_tallas', p.tabla_tallas, 'detalle_pie', p.detalle_pie,
    'instagram', p.instagram, 'actualizado', p.actualizado_en,
    'fotos', coalesce((
      select json_agg(case when f.ruta is not null then json_build_object(
                 'm', 'https://mgxljvxjonopchpvmjkl.supabase.co/storage/v1/object/public/productos/' || coalesce(f.ruta_miniatura, f.ruta),
                 'g', 'https://mgxljvxjonopchpvmjkl.supabase.co/storage/v1/object/public/productos/' || f.ruta,
                 'w', f.ancho, 'h', f.alto)
               else json_build_object('url', f.url_externa) end order by f.posicion)
        from rinbo.producto_fotos f where f.producto_id = p.id), '[]'::json))
$$;

create function public.catalogo() returns json
language sql stable security definer set search_path = ''
as $$
  select coalesce(json_agg(rinbo.producto_json(p) order by p.orden, p.creado_en), '[]'::json)
    from rinbo.productos p where p.publicado
$$;
comment on function public.catalogo() is 'Catálogo público de RINBŌ Ichiba: solo productos publicados.';

create function public.producto(p_id text) returns json
language sql stable security definer set search_path = ''
as $$
  select rinbo.producto_json(p) from rinbo.productos p where p.id = p_id and p.publicado
$$;
comment on function public.producto(text) is 'Un producto publicado de RINBŌ Ichiba (null si no existe o no está publicado).';

revoke execute on function rinbo.producto_json(rinbo.productos), public.catalogo(), public.producto(text) from public;
grant execute on function public.catalogo(), public.producto(text) to anon, authenticated, service_role;
grant execute on function rinbo.producto_json(rinbo.productos) to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000003', 'funciones_publicas');

commit;
