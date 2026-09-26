-- ============================================================
-- Fase 8 · Migración 9: guardar cada aviso de WhatsApp en UNA sola llamada
-- ============================================================
-- El 2026-09-26 el historial llegó de golpe (~1.650 avisos por minuto) y la API de la base se saturó: el buzón hacía
-- 3 llamadas por aviso (respaldo, mensajes, conteo). Esta función hace todo dentro de la base en una sola llamada.
-- Solo la puede usar el servidor (service_role, desde la Edge Function "whatsapp-webhook").
--
-- Cómo deshacer:
--   drop function rinbo.guardar_aviso_whatsapp(text, text, jsonb, jsonb);
--   delete from rinbo.migraciones where version = '20260926000009';
-- ============================================================

begin;

create function rinbo.guardar_aviso_whatsapp(p_evento_id text, p_tipo text, p_crudo jsonb, p_mensajes jsonb)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare n integer;
begin
  insert into rinbo.whatsapp_eventos (evento_id, tipo, crudo, mensajes)
  values (p_evento_id, coalesce(nullif(p_tipo, ''), 'desconocido'), p_crudo, coalesce(jsonb_array_length(p_mensajes), 0))
  on conflict (evento_id) do nothing;

  insert into rinbo.whatsapp_mensajes (wamid, telefono, nombre_perfil, direccion, tipo, texto, enviado_en, evento, crudo)
  select m->>'wamid', m->>'telefono', m->>'nombre_perfil', m->>'direccion', coalesce(m->>'tipo', 'text'), m->>'texto',
         (m->>'enviado_en')::timestamptz, m->>'evento', m->'crudo'
    from jsonb_array_elements(coalesce(p_mensajes, '[]'::jsonb)) m
  on conflict (wamid) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function rinbo.guardar_aviso_whatsapp(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function rinbo.guardar_aviso_whatsapp(text, text, jsonb, jsonb) to service_role;

insert into rinbo.migraciones (version, nombre) values ('20260926000009', 'guardar_aviso_whatsapp');

commit;
