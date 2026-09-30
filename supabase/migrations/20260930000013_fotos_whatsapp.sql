-- ============================================================
-- Fase 8 · Migración 13: fotos de WhatsApp guardadas en la Admin
-- ============================================================
-- Hasta ahora solo se guardaba el texto: de una foto quedaba "📷 Foto", sin la imagen.
-- YCloud manda en cada foto un link de descarga firmado que VENCE (en días), así que hay que bajarla apenas llega.
--   · whatsapp_mensajes.media_links: links recibidos (a veces la misma foto llega 2 veces con links distintos).
--   · media_ruta: dónde quedó guardada en la carpeta privada "whatsapp" (null = aún no).
--   · media_estado: null = pendiente, 'guardada', 'vencida' (el link ya no sirve), 'error' (falló 5 veces o es muy grande).
-- La Edge Function "whatsapp-fotos" baja y guarda las pendientes; la Admin las muestra con links temporales (1 hora).
--
-- Cómo deshacer:
--   (restaurar rinbo.guardar_aviso_whatsapp y rinbo.archivos_huerfanos desde las migraciones 9 y 2)
--   drop policy "admins leen fotos whatsapp" on storage.objects; drop policy "admins borran fotos whatsapp" on storage.objects;
--   delete from storage.objects where bucket_id = 'whatsapp'; delete from storage.buckets where id = 'whatsapp';
--   alter table rinbo.whatsapp_mensajes drop column media_links, drop column media_ruta, drop column media_estado, drop column media_intentos;
--   delete from rinbo.migraciones where version = '20260930000013';
-- ============================================================

begin;

alter table rinbo.whatsapp_mensajes
  add column media_links    text[],
  add column media_ruta     text,
  add column media_estado   text check (media_estado in ('guardada', 'vencida', 'error')),
  add column media_intentos smallint not null default 0;
create index whatsapp_mensajes_fotos_pendientes on rinbo.whatsapp_mensajes (id)
  where media_links is not null and media_estado is null;

-- Carpeta privada (WhatsApp ya comprime las fotos: llegan de 40 a 150 KB). Límite 5 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('whatsapp', 'whatsapp', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
create policy "admins leen fotos whatsapp" on storage.objects for select to authenticated
  using (bucket_id = 'whatsapp' and rinbo.es_admin());
create policy "admins borran fotos whatsapp" on storage.objects for delete to authenticated
  using (bucket_id = 'whatsapp' and rinbo.es_admin());

-- Guardar aviso: igual que antes, más los links de la foto. Si el mensaje ya existía (el historial repite
-- mensajes) y su foto aún no se guarda, se suman los links nuevos (alguno puede seguir sirviendo).
create or replace function rinbo.guardar_aviso_whatsapp(p_evento_id text, p_tipo text, p_crudo jsonb, p_mensajes jsonb)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare n integer;
begin
  insert into rinbo.whatsapp_eventos (evento_id, tipo, crudo, mensajes)
  values (p_evento_id, coalesce(nullif(p_tipo, ''), 'desconocido'), p_crudo, coalesce(jsonb_array_length(p_mensajes), 0))
  on conflict (evento_id) do nothing;

  insert into rinbo.whatsapp_mensajes as t (wamid, telefono, nombre_perfil, direccion, tipo, texto, enviado_en, evento, crudo, media_links)
  select m->>'wamid', m->>'telefono', m->>'nombre_perfil', m->>'direccion', coalesce(m->>'tipo', 'text'), m->>'texto',
         (m->>'enviado_en')::timestamptz, m->>'evento', m->'crudo',
         nullif(array(select jsonb_array_elements_text(coalesce(m->'media_links', '[]'::jsonb))), '{}')
    from jsonb_array_elements(coalesce(p_mensajes, '[]'::jsonb)) m
  on conflict (wamid) do update
     set media_links = array(select distinct unnest(coalesce(t.media_links, '{}') || excluded.media_links)),
         media_estado = case when t.media_estado = 'vencida' then null else t.media_estado end
   where excluded.media_links is not null and t.media_ruta is null
     and not coalesce(t.media_links, '{}') @> excluded.media_links;
  get diagnostics n = row_count;
  return n;
end $$;

-- Archivos sin uso: también las fotos de chats borrados de la Admin
create or replace function rinbo.archivos_huerfanos()
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
      or (o.bucket_id = 'whatsapp'
          and not exists (select 1 from rinbo.whatsapp_mensajes m where m.media_ruta = o.name))
   order by o.created_at;
end $$;

-- Fotos que ya llegaron: sacar sus links del respaldo de avisos (whatsapp_eventos)
with fotos as (
  select o->>'wamid' as wamid, o -> (o->>'type') ->> 'link' as link
    from rinbo.whatsapp_eventos e,
         jsonb_path_query(e.crudo, 'strict $.**?(@.wamid != null && (@.type == "image" || @.type == "sticker"))') o
   where e.crudo::text like '%/media/download/%'
)
update rinbo.whatsapp_mensajes m
   set media_links = l.links
  from (select wamid, array_agg(distinct link) as links from fotos where link is not null group by wamid) l
 where m.wamid = l.wamid;

insert into rinbo.migraciones (version, nombre) values ('20260930000013', 'fotos_whatsapp');

commit;
