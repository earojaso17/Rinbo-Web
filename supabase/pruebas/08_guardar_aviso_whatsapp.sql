-- Pruebas de la migración 9 (dentro de una transacción que se deshace).
create temp table resultado (n serial, prueba text, ok boolean, detalle text);
grant insert, select on resultado to authenticated, anon, service_role;
grant usage on sequence resultado_n_seq to authenticated, anon, service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ declare a int; b int; begin
  a := rinbo.guardar_aviso_whatsapp('ZT1', 'whatsapp.smb.history', '{"x":1}',
    '[{"wamid":"ZW1","telefono":"56900009999","direccion":"entrante","tipo":"text","texto":"hola","enviado_en":"2026-01-01T10:00:00Z","evento":"whatsapp.smb.history","crudo":{}},
      {"wamid":"ZW2","telefono":"56900009999","direccion":"saliente","texto":"chao","enviado_en":"2026-01-01T10:01:00Z"}]');
  b := rinbo.guardar_aviso_whatsapp('ZT1', 'whatsapp.smb.history', '{"x":1}', '[{"wamid":"ZW1","telefono":"56900009999","direccion":"entrante","enviado_en":"2026-01-01T10:00:00Z"}]');
  insert into resultado (prueba, ok, detalle) values ('guarda aviso y 2 mensajes; reintento no duplica', a = 2 and b = 0
    and (select count(*) from rinbo.whatsapp_eventos where evento_id = 'ZT1') = 1 and (select count(*) from rinbo.whatsapp_mensajes where wamid in ('ZW1','ZW2')) = 2, a || '/' || b);
  a := rinbo.guardar_aviso_whatsapp('ZT2', 'whatsapp.smb.app.state.sync', '{"c":1}', '[]');
  insert into resultado (prueba, ok, detalle) values ('aviso sin mensajes se respalda', a = 0 and exists (select 1 from rinbo.whatsapp_eventos where evento_id = 'ZT2'), a::text);
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
do $$ begin perform rinbo.guardar_aviso_whatsapp('x', 'x', '{}', '[]');
  insert into resultado (prueba, ok, detalle) values ('usuario no puede llamarla', false, 'pudo');
exception when insufficient_privilege then insert into resultado (prueba, ok, detalle) values ('usuario no puede llamarla', true, 'bloqueado'); end $$;
reset role;
select prueba, ok, detalle from resultado order by n;
