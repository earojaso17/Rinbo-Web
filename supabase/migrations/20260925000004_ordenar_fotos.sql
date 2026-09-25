-- ============================================================
-- Fase 3 · Migración 4: reordenar las fotos de un producto en un solo paso
-- ============================================================
-- La regla "una foto por posición" pasa a revisarse al final de la operación (deferrable), y
-- rinbo.ordenar_fotos(producto, [ids en el nuevo orden]) cambia todas las posiciones juntas.
-- Corre con los permisos de quien llama (RLS: solo administradores cambian algo).
--
-- Cómo deshacer:
--   drop function rinbo.ordenar_fotos(text, bigint[]);
--   alter table rinbo.producto_fotos drop constraint producto_fotos_posicion_unica,
--     add constraint producto_fotos_producto_id_posicion_key unique (producto_id, posicion);
--   delete from rinbo.migraciones where version = '20260925000004';
-- ============================================================

begin;

alter table rinbo.producto_fotos
  drop constraint producto_fotos_producto_id_posicion_key,
  add constraint producto_fotos_posicion_unica unique (producto_id, posicion) deferrable initially immediate;

create function rinbo.ordenar_fotos(p_producto_id text, p_ids bigint[]) returns void
language plpgsql set search_path = ''
as $$
begin
  set constraints rinbo.producto_fotos_posicion_unica deferred;
  update rinbo.producto_fotos f
     set posicion = x.orden
    from unnest(p_ids) with ordinality as x(id, orden)
   where f.id = x.id and f.producto_id = p_producto_id;
  set constraints rinbo.producto_fotos_posicion_unica immediate;  -- revisa aquí mismo y vuelve al modo normal
end $$;

revoke execute on function rinbo.ordenar_fotos(text, bigint[]) from public;
grant execute on function rinbo.ordenar_fotos(text, bigint[]) to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000004', 'ordenar_fotos');

commit;
