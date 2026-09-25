-- ============================================================
-- Migración 6: control de utilidad por pedido (solo para el dueño)
-- ============================================================
-- Precio de venta = pedidos.total_clp (el que ya existe). Se agregan costo del producto e impuestos pagados;
-- la utilidad la calcula la vista pedidos_resumen (venta − costo − impuestos).
-- Nada de esto sale en el seguimiento público (rinbo.seguimiento_publico arma su respuesta campo por campo).
--
-- Cómo deshacer:
--   drop view rinbo.pedidos_resumen;  (y volver a crearla como en la migración 5)
--   alter table rinbo.pedidos drop column costo_clp, drop column impuestos_clp;
--   delete from rinbo.migraciones where version = '20260925000006';
-- ============================================================

begin;

alter table rinbo.pedidos add column costo_clp integer not null default 0 check (costo_clp >= 0);
alter table rinbo.pedidos add column impuestos_clp integer not null default 0 check (impuestos_clp >= 0);
comment on column rinbo.pedidos.costo_clp is 'Privado: lo que costó el producto (compra en Japón + envío), en CLP.';
comment on column rinbo.pedidos.impuestos_clp is 'Privado: impuestos pagados (aduana, IVA), en CLP.';

-- p.* cambia de columnas: hay que recrear la vista
drop view rinbo.pedidos_resumen;
create view rinbo.pedidos_resumen with (security_invoker = true) as
select p.*,
       coalesce(sum(pg.monto_clp), 0)::integer               as abonado_clp,
       (p.total_clp - coalesce(sum(pg.monto_clp), 0))::integer as saldo_clp,
       c.nombre   as cliente_nombre,
       c.whatsapp as cliente_whatsapp,
       (p.total_clp - p.costo_clp - p.impuestos_clp)::integer  as utilidad_clp
  from rinbo.pedidos p
  left join rinbo.pagos pg on pg.pedido_id = p.id
  left join rinbo.clientes c on c.id = p.cliente_id
 group by p.id, c.id;
grant select on rinbo.pedidos_resumen to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000006', 'control_utilidad');

commit;
