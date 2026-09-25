// Todo el acceso a Supabase de RINBŌ Admin está en este archivo.
// Las tablas viven en el esquema privado "rinbo"; las reglas RLS dejan leer/escribir solo a administradores.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_LLAVE_PUBLICA, PLANILLA_CSV } from "../config.js";
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

// ---------- Importar desde la planilla de Google (transición a la Admin) ----------
function parseCSV(text) {
  const filas = []; let fila = [], campo = "", comillas = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (comillas) {
      if (c === '"' && text[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = (filas[0] || []).map(h => h.trim().toLowerCase());
  return filas.slice(1).map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] || "").trim()])));
}
const STOCKS = ["En Japón", "En Chile", "Por encargo", "Vendido"];
const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const nro = s => parseInt(String(s || "").replace(/\D/g, ""), 10) || 0;

function deFila(r, orden) {
  const stock = STOCKS.find(s => sinTildes(s) === sinTildes(r.stock)) || "En Japón";
  const oferta = nro(r.precio_oferta);
  return {
    producto: {
      id: r.id, nombre: r.nombre, categoria_principal: r.categoria_principal || null, categoria_secundaria: r.categoria_secundaria || null,
      detalle: r.detalle || null, marca: r.marca || null, opcion_1: r.opcion_1 || null, opcion_2: r.opcion_2 || null,
      descripcion: r.descripcion || null, estado: r.estado || "Nuevo", precio_clp: nro(r.precio_clp), precio_oferta: oferta || null,
      stock, publicado: String(r.publicado).toUpperCase() === "SI", destacado: String(r.destacado).toUpperCase() === "SI",
      tabla_tallas: r.tabla_tallas || null, detalle_pie: r.detalle_pie || null,
      instagram: /^https?:\/\//.test(r.instagram || "") ? r.instagram : null, orden
    },
    fotos: Array.from({ length: 12 }, (_, i) => r["foto_" + (i + 1)]).filter(Boolean).map((u, i) => ({ producto_id: r.id, posicion: i + 1, url_externa: u }))
  };
}

// sobrescribir = false: solo agrega los productos que no existen en la Admin.
// sobrescribir = true: además reemplaza los datos de los existentes con los de la planilla (y sus fotos,
// salvo en productos que ya tengan fotos subidas desde la Admin).
export async function importarPlanilla({ sobrescribir = false } = {}) {
  const res = await fetch(PLANILLA_CSV, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer la planilla (HTTP " + res.status + ").");
  const filas = parseCSV(await res.text()).filter(r => r.id && r.nombre);
  const existentes = await db().from("productos").select("id, orden, producto_fotos(ruta)").then(ok);
  const mapa = new Map(existentes.map(p => [p.id, p]));
  let ordenNuevo = Math.max(0, ...existentes.map(p => p.orden || 0)) + 1;
  const r = { nuevos: 0, actualizados: 0, sinCambios: 0, errores: [], total: filas.length };
  for (const fila of filas) {
    const existe = mapa.get(fila.id);
    const { producto, fotos } = deFila(fila, existe ? existe.orden : ordenNuevo++);
    try {
      if (!existe) {
        await db().from("productos").insert(producto).then(ok);
        if (fotos.length) await db().from("producto_fotos").insert(fotos).then(ok);
        r.nuevos++;
      } else if (sobrescribir) {
        await db().from("productos").update(producto).eq("id", producto.id).then(ok);
        if (!existe.producto_fotos.some(f => f.ruta)) {
          await db().from("producto_fotos").delete().eq("producto_id", producto.id).then(ok);
          if (fotos.length) await db().from("producto_fotos").insert(fotos).then(ok);
        }
        r.actualizados++;
      } else r.sinCambios++;
    } catch (e) { r.errores.push(`${producto.id}: ${mensajeError(e)}`); }
  }
  return r;
}

// Dirección del producto en rinbo.store (misma regla que el robot: nombre sin tildes, en minúsculas y con guiones)
export const urlEnLaWeb = nombre => "https://rinbo.store/producto/" + sinTildes(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "/";

// ---------- Publicar ahora (sin esperar al robot cada 15 min) ----------
// Llama a /api/publicar (Cloudflare Pages Function), que pide a GitHub correr el robot. El token de GitHub vive en Cloudflare.
async function llamarPublicar(metodo) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/publicar", { method: metodo, headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
  let cuerpo = {};
  try { cuerpo = await res.json(); } catch { /* respuesta vacía (p. ej. en `npm run dev`, sin funciones) */ }
  if (!res.ok) throw new Error(cuerpo.error || `No se pudo publicar (HTTP ${res.status}).`);
  return cuerpo;
}
export const publicarAhora = () => llamarPublicar("POST");
export const estadoPublicacion = () => llamarPublicar("GET");
