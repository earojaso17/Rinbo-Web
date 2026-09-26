-- Convierte en mensajes los avisos respaldados en rinbo.whatsapp_eventos que aún no lo son (mismas reglas que el buzón).
-- Uso: correr por la Management API. Seguro de repetir: los mensajes ya guardados se ignoran (wamid único).
with e as (
  select e.tipo, coalesce(e.crudo->'whatsappMessage', e.crudo->'whatsappInboundMessage') m, (e.crudo ? 'whatsappMessage') es_msg
    from rinbo.whatsapp_eventos e
   where coalesce(e.crudo->'whatsappMessage'->>'wamid', e.crudo->'whatsappInboundMessage'->>'wamid') is not null
     and not exists (select 1 from rinbo.whatsapp_mensajes x where x.wamid = coalesce(e.crudo->'whatsappMessage'->>'wamid', e.crudo->'whatsappInboundMessage'->>'wamid'))
), d as (
  select tipo, m, es_msg, regexp_replace(coalesce(m->>'from',''), '\D', '', 'g') de, regexp_replace(coalesce(m->>'to',''), '\D', '', 'g') para from e
), s as (
  select *, (tipo like '%echo%' or tipo like '%sent%' or (de = '819039343820' and para <> '819039343820')
             or (de = '' and para <> '' and para <> '819039343820') or (es_msg and para <> '819039343820')) saliente from d
), f as (
  select m->>'wamid' wamid,
         case when saliente then para else de end telefono,
         case when saliente then null else m->'customerProfile'->>'name' end nombre_perfil,
         case when saliente then 'saliente' else 'entrante' end direccion,
         coalesce(m->>'type', 'text') tipo_m,
         case m->>'type'
           when 'text' then m->'text'->>'body'
           when 'reaction' then case when m->'reaction'->>'emoji' is not null then 'Reaccionó ' || (m->'reaction'->>'emoji') end
           when 'button' then m->'button'->>'text'
           else coalesce(m->(m->>'type')->>'caption', m->(m->>'type')->>'filename', m->(m->>'type')->>'body') end texto,
         coalesce(case when coalesce(m->>'sendTime', m->>'timestamp') ~ '^\d+$' then to_timestamp(coalesce(m->>'sendTime', m->>'timestamp')::bigint) end,
                  (coalesce(m->>'sendTime', m->>'timestamp', m->>'deliverTime', m->>'createTime'))::timestamptz, now()) enviado_en,
         tipo evento, m crudo
    from s
)
insert into rinbo.whatsapp_mensajes (wamid, telefono, nombre_perfil, direccion, tipo, texto, enviado_en, evento, crudo)
select distinct on (wamid) wamid, telefono, nombre_perfil, direccion, tipo_m, texto, enviado_en, evento, crudo
  from f where telefono ~ '^[0-9]{6,20}$' and telefono <> '819039343820'
on conflict (wamid) do nothing;
select (select count(*) from rinbo.whatsapp_mensajes) mensajes, (select count(distinct telefono) from rinbo.whatsapp_mensajes) chats,
 (select count(*) from rinbo.whatsapp_eventos e where coalesce(e.crudo->'whatsappMessage'->>'wamid', e.crudo->'whatsappInboundMessage'->>'wamid') is not null
   and not exists (select 1 from rinbo.whatsapp_mensajes x where x.wamid = coalesce(e.crudo->'whatsappMessage'->>'wamid', e.crudo->'whatsappInboundMessage'->>'wamid'))) sin_convertir;
