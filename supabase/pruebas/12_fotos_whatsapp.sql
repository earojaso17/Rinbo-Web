-- Pruebas de la migración 13 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;

do $$ declare r record; n int; begin
  -- 1. Foto nueva con su link
  perform rinbo.guardar_aviso_whatsapp('prueba-f1', 'whatsapp.inbound_message.received', '{}'::jsonb,
    '[{"wamid":"wamid.PRUEBA1","telefono":"56911112222","direccion":"entrante","tipo":"image","enviado_en":"2026-09-30T10:00:00Z","media_links":["https://x/1"]}]');
  select * into r from rinbo.whatsapp_mensajes where wamid = 'wamid.PRUEBA1';
  insert into resultado (prueba, ok, detalle) values ('foto nueva guarda su link', r.media_links = '{https://x/1}' and r.media_estado is null, r.media_links::text);

  -- 2. El historial repite el mensaje con otro link: se suman
  perform rinbo.guardar_aviso_whatsapp('prueba-f2', 'whatsapp.smb.history', '{}'::jsonb,
    '[{"wamid":"wamid.PRUEBA1","telefono":"56911112222","direccion":"entrante","tipo":"image","enviado_en":"2026-09-30T10:00:00Z","media_links":["https://x/2"]}]');
  select * into r from rinbo.whatsapp_mensajes where wamid = 'wamid.PRUEBA1';
  insert into resultado (prueba, ok, detalle) values ('repetido suma links', r.media_links @> '{https://x/1,https://x/2}' and cardinality(r.media_links) = 2, r.media_links::text);

  -- 3. Si ya está guardada, no se toca
  update rinbo.whatsapp_mensajes set media_ruta = '56911112222/a.jpg', media_estado = 'guardada' where wamid = 'wamid.PRUEBA1';
  perform rinbo.guardar_aviso_whatsapp('prueba-f3', 'whatsapp.smb.history', '{}'::jsonb,
    '[{"wamid":"wamid.PRUEBA1","telefono":"56911112222","direccion":"entrante","tipo":"image","enviado_en":"2026-09-30T10:00:00Z","media_links":["https://x/3"]}]');
  select * into r from rinbo.whatsapp_mensajes where wamid = 'wamid.PRUEBA1';
  insert into resultado (prueba, ok, detalle) values ('guardada no cambia', cardinality(r.media_links) = 2 and r.media_estado = 'guardada', r.media_links::text);

  -- 4. Texto repetido sigue sin duplicarse ni cambiar
  perform rinbo.guardar_aviso_whatsapp('prueba-f4', 'x', '{}'::jsonb, '[{"wamid":"wamid.PRUEBA2","telefono":"56911112222","direccion":"entrante","texto":"hola","enviado_en":"2026-09-30T10:00:00Z"}]');
  perform rinbo.guardar_aviso_whatsapp('prueba-f5', 'x', '{}'::jsonb, '[{"wamid":"wamid.PRUEBA2","telefono":"56911112222","direccion":"entrante","texto":"otro","enviado_en":"2026-09-30T10:00:00Z"}]');
  select count(*) into n from rinbo.whatsapp_mensajes where wamid = 'wamid.PRUEBA2' and texto = 'hola' and media_links is null;
  insert into resultado (prueba, ok, detalle) values ('texto repetido no se duplica', n = 1, n::text);

  -- 5. Las fotos que ya llegaron quedaron con sus links
  select count(*) into n from rinbo.whatsapp_mensajes where tipo in ('image', 'sticker') and media_links is not null and wamid not like 'wamid.PRUEBA%';
  insert into resultado (prueba, ok, detalle) values ('fotos antiguas con link', n >= 18, n::text);
end $$;

-- 6. Carpeta privada: un no-admin no ve fotos; el visitante tampoco
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000b002', 'cualquiera@ejemplo.cl');
insert into storage.objects (bucket_id, name, metadata) values ('whatsapp', '56911112222/a.jpg', '{"size": 1000}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id = 'whatsapp';
  insert into resultado (prueba, ok, detalle) values ('no admin no ve fotos de chats', n = 0, n::text);
end $$;
reset role;
set local role anon;
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id = 'whatsapp';
  insert into resultado (prueba, ok, detalle) values ('visitante no ve fotos de chats', n = 0, n::text);
end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
