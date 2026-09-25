# Importa a Supabase (rinbo.productos + rinbo.producto_fotos) los productos que hoy publica rinbo.store.
# Fuente: web/datos/catalogo.json (lo genera el robot desde la planilla; SOLO productos publicados) y
# web-plantillas/estado-catalogo.json (link original de Google Drive de cada foto).
# Las fotos quedan como url_externa (Drive); al editarlas en la Admin se suben al bucket.
# Uso: python3 supabase/importar/desde_catalogo_web.py > /tmp/importar.sql  (y ejecutar ese SQL)
# Es idempotente: si el código ya existe en la base, ese producto no se toca.
import json
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
catalogo = json.loads((RAIZ / 'web/datos/catalogo.json').read_text(encoding='utf-8'))
estado = json.loads((RAIZ / 'web-plantillas/estado-catalogo.json').read_text(encoding='utf-8'))
origen_de = {v['m']: k.split('|', 1)[1] for k, v in estado['fotos'].items()}

def texto_opcion(o):
    return f"{o['nombre']}: {' | '.join(o['valores'])}" if o else None

productos, fotos = [], []
for orden, p in enumerate(catalogo):
    ops = p.get('ops') or []
    productos.append({
        'id': p['id'], 'nombre': p['nombre'], 'categoria_principal': p['cat'] or None, 'categoria_secundaria': p['sub'] or None,
        'detalle': p['detalle'] or None, 'marca': p.get('marca') or None,
        'opcion_1': texto_opcion(ops[0]) if len(ops) > 0 else None, 'opcion_2': texto_opcion(ops[1]) if len(ops) > 1 else None,
        'descripcion': p['desc'] or None, 'estado': p['estado'] or 'Nuevo', 'precio_clp': p['precio'] or 0,
        'precio_oferta': p['oferta'] or None, 'stock': p['stock'], 'publicado': True, 'destacado': bool(p['destacado']),
        'tabla_tallas': p['tabla'] or None, 'detalle_pie': p['pie'] or None, 'instagram': p['ig'] or None, 'orden': orden})
    for i, f in enumerate(p['fotos'], start=1):
        url = f.get('url') or origen_de.get(f.get('m'))
        if not url:
            sys.exit(f"Foto sin link original: {p['id']} #{i}")
        fotos.append({'producto_id': p['id'], 'posicion': i, 'url_externa': url})

datos = json.dumps({'productos': productos, 'fotos': fotos}, ensure_ascii=False).replace("'", "''")
print(f"""begin;
with d as (select '{datos}'::json as j),
nuevos as (
  insert into rinbo.productos (id, nombre, categoria_principal, categoria_secundaria, detalle, marca, opcion_1, opcion_2, descripcion,
                               estado, precio_clp, precio_oferta, stock, publicado, destacado, tabla_tallas, detalle_pie, instagram, orden)
  select x.* from d, json_populate_recordset(null::rinbo.productos, d.j -> 'productos') r,
         lateral (select r.id, r.nombre, r.categoria_principal, r.categoria_secundaria, r.detalle, r.marca, r.opcion_1, r.opcion_2, r.descripcion,
                         r.estado, r.precio_clp, r.precio_oferta, r.stock, r.publicado, r.destacado, r.tabla_tallas, r.detalle_pie, r.instagram, r.orden) x
  on conflict (id) do nothing
  returning id)
insert into rinbo.producto_fotos (producto_id, posicion, url_externa)
select f.producto_id, f.posicion, f.url_externa
  from d, json_to_recordset(d.j -> 'fotos') as f(producto_id text, posicion smallint, url_externa text)
 where f.producto_id in (select id from nuevos);
commit;""")
