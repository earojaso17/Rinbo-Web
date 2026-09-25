// Todo el acceso a Supabase de RINBŌ Admin está en este archivo.
// Las tablas viven en el esquema privado "rinbo"; las reglas RLS dejan leer/escribir solo a administradores.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_LLAVE_PUBLICA } from "../config.js";
import { prepararFoto } from "./fotos.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_LLAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "rinbo_admin_sesion" }
});
const db = () => supabase.schema("rinbo");
const BUCKET = "productos";

// Mensajes de error entendibles
export function mensajeError(e) {
  const m = String(e?.message || e || "");
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "El correo aún no está confirmado.";
  if (/duplicate key.*productos_pkey/i.test(m)) return "Ya existe un producto con ese código.";
  if (/productos_stock_check/i.test(m)) return "El stock debe ser En Japón, En Chile, Por encargo o Vendido.";
  if (/productos_id_check/i.test(m)) return "El código solo puede tener letras, números, guiones y guion bajo.";
  if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para hacer esto (¿sesión vencida?).";
  if (/Invalid schema|PGRST106/i.test(m)) return "La base de datos aún no está habilitada para la Admin (falta exponer el esquema rinbo).";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return "La foto quedó muy pesada incluso comprimida.";
  return m || "Ocurrió un error.";
}
const ok = ({ data, error }) => { if (error) throw error; return data; };

// ---------- Sesión ----------
export const entrar = (email, password) => supabase.auth.signInWithPassword({ email, password }).then(ok);
export const salir = () => supabase.auth.signOut();
export const esAdmin = () => db().rpc("es_admin").then(ok).then(r => r === true);

// ---------- Inicio ----------
export const usoAlmacenamiento = () => db().rpc("uso_almacenamiento").then(ok);
export async function borrarArchivosHuerfanos() {
  const lista = await db().rpc("archivos_huerfanos").then(ok);
  const productos = lista.filter(a => a.carpeta === BUCKET).map(a => a.ruta);
  if (productos.length) await supabase.storage.from(BUCKET).remove(productos).then(ok);
  return productos.length;
}

// ---------- Productos ----------
const COLUMNAS = "*, producto_fotos(id, posicion, ruta, ruta_miniatura, url_externa, ancho, alto, bytes)";
const ordenarFotos = p => ({ ...p, producto_fotos: [...(p.producto_fotos || [])].sort((a, b) => a.posicion - b.posicion) });

export const listarProductos = () =>
  db().from("productos").select(COLUMNAS).order("orden").order("creado_en", { ascending: false }).then(ok).then(l => l.map(ordenarFotos));

export const obtenerProducto = id =>
  db().from("productos").select(COLUMNAS).eq("id", id).maybeSingle().then(ok).then(p => p && ordenarFotos(p));

// Campos que se pueden editar (el resto lo maneja la base)
export const CAMPOS = ["id", "nombre", "categoria_principal", "categoria_secundaria", "detalle", "marca", "opcion_1", "opcion_2",
  "descripcion", "estado", "precio_clp", "precio_oferta", "stock", "publicado", "destacado", "tabla_tallas", "detalle_pie", "instagram", "orden"];
function limpiar(p) {
  const r = {};
  for (const c of CAMPOS) {
    let v = p[c];
    if (typeof v === "string") v = v.trim();
    if (["precio_clp", "precio_oferta", "orden"].includes(c)) v = v === "" || v == null ? (c === "precio_oferta" ? null : 0) : parseInt(String(v).replace(/\D/g, ""), 10) || 0;
    if (c === "precio_oferta" && v === 0) v = null;
    if (v === "") v = null;
    r[c] = v;
  }
  if (!r.estado) r.estado = "Nuevo";
  return r;
}
export const crearProducto = p => db().from("productos").insert(limpiar(p)).select(COLUMNAS).single().then(ok).then(ordenarFotos);
export const actualizarProducto = (idOriginal, p) =>
  db().from("productos").update(limpiar(p)).eq("id", idOriginal).select(COLUMNAS).single().then(ok).then(ordenarFotos);
export const cambiarCampo = (id, cambios) => db().from("productos").update(cambios).eq("id", id).then(ok);

export async function borrarProducto(p) {
  const rutas = (p.producto_fotos || []).flatMap(f => [f.ruta, f.ruta_miniatura]).filter(Boolean);
  await db().from("productos").delete().eq("id", p.id).then(ok);
  if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas); // si falla, quedan como "archivos sin uso" (se limpian en Inicio)
}

// ---------- Fotos ----------
export const urlPublica = ruta => ruta ? supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl : "";
const azar = () => Math.random().toString(36).slice(2, 10);

// Comprime la foto en el navegador (1200 px y 600 px) y la sube; devuelve la fila creada.
export async function subirFoto(productoId, archivo, posicion) {
  const f = await prepararFoto(archivo);
  const base = `${productoId}/${Date.now().toString(36)}-${azar()}`;
  const ruta = `${base}-1200.${f.ext}`, rutaMin = `${base}-600.${f.ext}`;
  const opciones = { contentType: f.tipo, cacheControl: "31536000", upsert: false };
  await supabase.storage.from(BUCKET).upload(ruta, f.grande.blob, opciones).then(ok);
  try {
    await supabase.storage.from(BUCKET).upload(rutaMin, f.chica.blob, opciones).then(ok);
    return await db().from("producto_fotos").insert({
      producto_id: productoId, posicion, ruta, ruta_miniatura: rutaMin,
      ancho: f.grande.ancho, alto: f.grande.alto, bytes: f.grande.blob.size + f.chica.blob.size
    }).select().single().then(ok);
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([ruta, rutaMin]);
    throw e;
  }
}

export async function borrarFoto(productoId, foto, restantes) {
  await db().from("producto_fotos").delete().eq("id", foto.id).then(ok);
  await supabase.storage.from(BUCKET).remove([foto.ruta, foto.ruta_miniatura].filter(Boolean));
  if (restantes.length) await ordenar(productoId, restantes.map(x => x.id)); // sin huecos: 1, 2, 3…
}

export const ordenar = (productoId, ids) => db().rpc("ordenar_fotos", { p_producto_id: productoId, p_ids: ids }).then(ok);
