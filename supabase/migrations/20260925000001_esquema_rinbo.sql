-- ============================================================
-- Fase 2 · Migración 1: esquema privado "rinbo", tablas de la Admin y RLS
-- ============================================================
-- Todo vive en el esquema "rinbo", que NO está en la lista de esquemas expuestos por la API
-- pública de Supabase, y el rol "anon" (visitantes) no tiene ningún permiso sobre él.
-- Además cada tabla tiene RLS: solo quien esté en rinbo.admins (con sesión iniciada) lee o escribe.
--
-- Cómo deshacer (mientras la base no tenga datos reales):
--   drop schema rinbo cascade;
-- ============================================================

begin;

create schema rinbo;
comment on schema rinbo is 'RINBŌ Ichiba: datos de la Admin (privado, no expuesto a la API pública).';

revoke all on schema rinbo from public;
grant usage on schema rinbo to authenticated, service_role;

-- ---------- Registro de migraciones aplicadas ----------
create table rinbo.migraciones (
  version     text primary key,
  nombre      text not null,
  aplicada_en timestamptz not null default now()
);

-- ---------- Administradores ----------
create table rinbo.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  nombre    text,
  creado_en timestamptz not null default now()
);
comment on table rinbo.admins is 'Quién puede entrar a la Admin. Se agrega a mano (SQL), nunca desde la API.';

create function rinbo.es_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from rinbo.admins where user_id = auth.uid()) $$;

-- ---------- Utilidades ----------
create function rinbo.tocar_actualizado() returns trigger
language plpgsql set search_path = ''
as $$ begin new.actualizado_en := now(); return new; end $$;

-- Código secreto de seguimiento: 10 caracteres sin letras confusas (sin 0/O, 1/I/L), ej. K7QMX-4PAR9
create function rinbo.nuevo_codigo_seguimiento() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea := extensions.gen_random_bytes(10);
  r text := '';
begin
  for i in 0..9 loop
    r := r || substr(alfabeto, 1 + (get_byte(b, i) % 31), 1);
    if i = 4 then r := r || '-'; end if;
  end loop;
  return r;
end $$;

-- Las 9 etapas (mismo texto y orden que el sitio)
create type rinbo.etapa_pedido as enum (
  'Encargo Confirmado', 'Comprado en Japón', 'En Bodega Japón', 'Enviado a Chile',
  'En Tránsito a Chile', 'En Aduana', 'En Bodega Chile', 'Enviado', 'Entregado'
);

-- ---------- Productos (reemplaza la pestaña Catálogo) ----------
create table rinbo.productos (
  id                   text primary key check (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  nombre               text not null check (length(trim(nombre)) > 0),
  categoria_principal  text,
  categoria_secundaria text,
  detalle              text,
  marca                text,
  opcion_1             text,          -- "Talla: S | M | L"
  opcion_2             text,
  descripcion          text,
  estado               text not null default 'Nuevo',   -- "Nuevo", "Usado", "Usado — A"…
  precio_clp           integer not null default 0 check (precio_clp >= 0),   -- 0 = "A consultar"
  precio_oferta        integer check (precio_oferta >= 0),
  stock                text not null default 'En Japón' check (stock in ('En Japón', 'En Chile', 'Por encargo', 'Vendido')),
  publicado            boolean not null default false,
  destacado            boolean not null default false,
  tabla_tallas         text,
  detalle_pie          text,
  instagram            text,
  orden                integer not null default 0,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
create trigger productos_actualizado before update on rinbo.productos
  for each row execute function rinbo.tocar_actualizado();

create table rinbo.producto_fotos (
  id             bigint generated always as identity primary key,
  producto_id    text not null references rinbo.productos (id) on delete cascade on update cascade,
  posicion       smallint not null check (posicion between 1 and 12),
  ruta           text,            -- archivo en el bucket "productos" (foto grande)
  ruta_miniatura text,            -- archivo en el bucket "productos" (miniatura)
  url_externa    text,            -- link de Google Drive, mientras dure la importación
  ancho          integer,
  alto           integer,
  bytes          integer not null default 0,
  creado_en      timestamptz not null default now(),
  unique (producto_id, posicion),
  check (ruta is not null or url_externa is not null)
);

-- ---------- Clientes ----------
create table rinbo.clientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) > 0),
  whatsapp       text,
  instagram      text,
  email          text,
  ciudad         text,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create trigger clientes_actualizado before update on rinbo.clientes
  for each row execute function rinbo.tocar_actualizado();

-- ---------- Pedidos ----------
create sequence rinbo.pedidos_codigo_seq;   -- al importar los pedidos actuales se ajusta al último número

create table rinbo.pedidos (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique default ('R' || lpad(nextval('rinbo.pedidos_codigo_seq')::text, 5, '0'))
                          check (codigo ~ '^[A-Z0-9]+$'),
  codigo_seguimiento    text not null unique default rinbo.nuevo_codigo_seguimiento(),
  cliente_id            uuid references rinbo.clientes (id) on delete restrict,
  etapa                 rinbo.etapa_pedido not null default 'Encargo Confirmado',  -- la calcula la base desde el historial
  total_clp             integer not null default 0 check (total_clp >= 0),
  comentarios_generales text,   -- lo ve el cliente en el seguimiento
  notas_internas        text,   -- solo para la Admin
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
alter sequence rinbo.pedidos_codigo_seq owned by rinbo.pedidos.codigo;
create index on rinbo.pedidos (cliente_id);
create trigger pedidos_actualizado before update on rinbo.pedidos
  for each row execute function rinbo.tocar_actualizado();

create table rinbo.pedido_items (
  id                  bigint generated always as identity primary key,
  pedido_id           uuid not null references rinbo.pedidos (id) on delete cascade,
  producto_id         text references rinbo.productos (id) on delete set null on update cascade,
  descripcion         text not null,        -- lo que se compró (queda aunque el producto se borre)
  cantidad            integer not null default 1 check (cantidad > 0),
  precio_unitario_clp integer not null default 0 check (precio_unitario_clp >= 0)
);
create index on rinbo.pedido_items (pedido_id);
create index on rinbo.pedido_items (producto_id);

-- Historial de etapas: cada avance del pedido
create table rinbo.pedido_etapas (
  id              bigint generated always as identity primary key,
  pedido_id       uuid not null references rinbo.pedidos (id) on delete cascade,
  etapa           rinbo.etapa_pedido not null,
  fecha           date not null default current_date,
  comentario      text,
  visible_cliente boolean not null default true,
  creado_en       timestamptz not null default now()
);
create index on rinbo.pedido_etapas (pedido_id);

-- La etapa actual del pedido = la más avanzada de su historial
create function rinbo.sincronizar_etapa() returns trigger
language plpgsql set search_path = ''
as $$
declare pid uuid;
begin
  for pid in select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.pedido_id end,
      case when tg_op <> 'DELETE' then new.pedido_id end]) as x where x is not null
  loop
    update rinbo.pedidos p
       set etapa = coalesce((select max(e.etapa) from rinbo.pedido_etapas e where e.pedido_id = pid), 'Encargo Confirmado')
     where p.id = pid;
  end loop;
  return null;
end $$;
create trigger pedido_etapas_sincronizar after insert or update or delete on rinbo.pedido_etapas
  for each row execute function rinbo.sincronizar_etapa();

-- Abonos y pagos (positivo = pago del cliente; negativo = devolución)
create table rinbo.pagos (
  id        bigint generated always as identity primary key,
  pedido_id uuid not null references rinbo.pedidos (id) on delete cascade,
  fecha     date not null default current_date,
  monto_clp integer not null check (monto_clp <> 0),
  medio     text,
  nota      text,
  creado_en timestamptz not null default now()
);
create index on rinbo.pagos (pedido_id);

-- Fotos del pedido (compra, empaque, envío…), en el bucket privado "evidencias"
create table rinbo.evidencias (
  id               bigint generated always as identity primary key,
  pedido_id        uuid not null references rinbo.pedidos (id) on delete cascade,
  pedido_etapa_id  bigint references rinbo.pedido_etapas (id) on delete set null,
  ruta             text not null,
  descripcion      text,
  visible_cliente  boolean not null default true,
  bytes            integer not null default 0,
  creado_en        timestamptz not null default now()
);
create index on rinbo.evidencias (pedido_id);
create index on rinbo.evidencias (pedido_etapa_id);

-- Resumen para la Admin: abonado y saldo calculados (respeta RLS de quien consulta)
create view rinbo.pedidos_resumen with (security_invoker = true) as
select p.*,
       coalesce(sum(pg.monto_clp), 0)::integer               as abonado_clp,
       (p.total_clp - coalesce(sum(pg.monto_clp), 0))::integer as saldo_clp
  from rinbo.pedidos p
  left join rinbo.pagos pg on pg.pedido_id = p.id
 group by p.id;

-- ---------- RLS: todo cerrado salvo para administradores ----------
alter table rinbo.migraciones    enable row level security;
alter table rinbo.admins         enable row level security;
alter table rinbo.productos      enable row level security;
alter table rinbo.producto_fotos enable row level security;
alter table rinbo.clientes       enable row level security;
alter table rinbo.pedidos        enable row level security;
alter table rinbo.pedido_items   enable row level security;
alter table rinbo.pedido_etapas  enable row level security;
alter table rinbo.pagos          enable row level security;
alter table rinbo.evidencias     enable row level security;

create policy "admins ven admins" on rinbo.admins for select to authenticated using (rinbo.es_admin());
create policy "solo admins" on rinbo.productos      for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.producto_fotos for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.clientes       for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.pedidos        for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.pedido_items   for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.pedido_etapas  for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.pagos          for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
create policy "solo admins" on rinbo.evidencias     for all to authenticated using (rinbo.es_admin()) with check (rinbo.es_admin());
-- rinbo.migraciones: sin políticas (solo el dueño de la base la usa)

-- ---------- Permisos ----------
-- anon (visitantes de internet): nada. authenticated: lo necesario para la Admin (RLS decide qué filas).
-- Postgres deja las funciones nuevas ejecutables por cualquiera (PUBLIC): aquí se cierran todas y se abren solo las necesarias.
revoke execute on all functions in schema rinbo from public;
grant select, insert, update, delete on all tables in schema rinbo to authenticated;
revoke all on rinbo.migraciones from authenticated;
revoke insert, update, delete on rinbo.admins from authenticated;
grant all on all tables in schema rinbo to service_role;
grant usage, select on all sequences in schema rinbo to authenticated, service_role;
grant execute on function rinbo.es_admin() to authenticated, service_role;
grant execute on function rinbo.nuevo_codigo_seguimiento() to authenticated, service_role;

insert into rinbo.migraciones (version, nombre) values ('20260925000001', 'esquema_rinbo');

commit;
