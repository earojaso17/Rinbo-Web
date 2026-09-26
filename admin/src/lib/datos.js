// Todo el acceso a Supabase de RINBŌ Admin está en este archivo.
// Las tablas viven en el esquema privado "rinbo"; las reglas RLS dejan leer/escribir solo a administradores.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_LLAVE_PUBLICA, PLANILLA_CSV, SITIO } from "../config.js";
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
  if (/pedidos_codigo_key/i.test(m)) return "Ya existe un pedido con ese código.";
  if (/pedidos_cliente_id_fkey/i.test(m)) return "Este cliente tiene pedidos: cámbialos de cliente o bórralos primero.";
  if (/monto_clp_check/i.test(m)) return "El monto no puede ser 0.";
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

// ============================================================
// Fase 5: clientes y pedidos
// ============================================================
export const ETAPAS = ["Encargo Confirmado", "Comprado en Japón", "En Bodega Japón", "Enviado a Chile",
  "En Tránsito a Chile", "En Aduana", "En Bodega Chile", "Enviado", "Entregado"];
const EVIDENCIAS = "evidencias";
const texto = v => { const t = typeof v === "string" ? v.trim() : v; return t === "" || t == null ? null : t; };
export const aPesos = v => parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10) || 0;
// Solo dígitos, con código de país (Chile 56 si viene sin él: 9 1234 5678 → 56912345678)
export const limpiarWhatsapp = v => {
  const d = String(v || "").replace(/\D/g, "");
  return !d ? null : d.length === 9 && d.startsWith("9") ? "56" + d : d;
};

// ---------- Clientes ----------
const CAMPOS_CLIENTE = ["nombre", "whatsapp", "instagram", "email", "ciudad", "notas"];
const limpiarCliente = c => {
  const r = Object.fromEntries(CAMPOS_CLIENTE.map(k => [k, texto(c[k])]));
  r.whatsapp = limpiarWhatsapp(r.whatsapp);
  return r;
};
export const listarClientes = () => db().from("clientes").select("*, pedidos(count)").order("nombre").then(ok);
export const obtenerCliente = id => db().from("clientes").select("*").eq("id", id).maybeSingle().then(ok);
export const crearCliente = c => db().from("clientes").insert(limpiarCliente(c)).select().single().then(ok);
export const actualizarCliente = (id, c) => db().from("clientes").update(limpiarCliente(c)).eq("id", id).select().single().then(ok);
export const borrarCliente = id => db().from("clientes").delete().eq("id", id).then(ok);

// ---------- Pedidos ----------
export const listarPedidos = ({ clienteId } = {}) => {
  let q = db().from("pedidos_resumen").select("id, codigo, codigo_seguimiento, cliente_id, cliente_nombre, cliente_whatsapp, etapa, total_clp, abonado_clp, saldo_clp, costo_clp, impuestos_clp, utilidad_clp, creado_en, actualizado_en");
  if (clienteId) q = q.eq("cliente_id", clienteId);
  return q.order("creado_en", { ascending: false }).then(ok);
};

const DETALLE = "*, clientes(*), pedido_items(*), pedido_etapas(*), pagos(*), evidencias(*)";
const ordenarDetalle = p => p && ({
  ...p,
  pedido_items: [...p.pedido_items].sort((a, b) => a.id - b.id),
  pedido_etapas: [...p.pedido_etapas].sort((a, b) => ETAPAS.indexOf(a.etapa) - ETAPAS.indexOf(b.etapa) || a.fecha.localeCompare(b.fecha) || a.id - b.id),
  pagos: [...p.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id),
  evidencias: [...p.evidencias].sort((a, b) => a.id - b.id),
  abonado_clp: p.pagos.reduce((s, x) => s + x.monto_clp, 0)
});
export const obtenerPedido = id => db().from("pedidos").select(DETALLE).eq("id", id).maybeSingle().then(ok).then(ordenarDetalle);

const limpiarPedido = p => ({
  cliente_id: p.cliente_id || null, total_clp: Math.max(0, aPesos(p.total_clp)),
  costo_clp: Math.max(0, aPesos(p.costo_clp)), impuestos_clp: Math.max(0, aPesos(p.impuestos_clp)),
  comentarios_generales: texto(p.comentarios_generales), notas_internas: texto(p.notas_internas)
});
// Pedido nuevo: queda con la primera etapa (Encargo Confirmado) con fecha de hoy
export async function crearPedido(p) {
  const nuevo = await db().from("pedidos").insert(limpiarPedido(p)).select("id").single().then(ok);
  await db().from("pedido_etapas").insert({ pedido_id: nuevo.id, etapa: ETAPAS[0] }).then(ok);
  return nuevo.id;
}
export const actualizarPedido = (id, p) => db().from("pedidos").update(limpiarPedido(p)).eq("id", id).then(ok);
export async function borrarPedido(p) {
  const rutas = p.evidencias.map(e => e.ruta).filter(Boolean);
  await db().from("pedidos").delete().eq("id", p.id).then(ok);
  if (rutas.length) await supabase.storage.from(EVIDENCIAS).remove(rutas);
}
// Código secreto nuevo (si el link se compartió con quien no debía): el link anterior deja de funcionar
export async function cambiarCodigoSeguimiento(id) {
  const codigo = await db().rpc("nuevo_codigo_seguimiento").then(ok);
  await db().from("pedidos").update({ codigo_seguimiento: codigo }).eq("id", id).then(ok);
  return codigo;
}

// Artículos
export const agregarItem = (pedidoId, it) => db().from("pedido_items").insert({
  pedido_id: pedidoId, producto_id: texto(it.producto_id), descripcion: texto(it.descripcion) || "Artículo",
  cantidad: Math.max(1, aPesos(it.cantidad)), precio_unitario_clp: Math.max(0, aPesos(it.precio_unitario_clp))
}).then(ok);
export const borrarItem = id => db().from("pedido_items").delete().eq("id", id).then(ok);

// Etapas (la etapa actual del pedido la calcula la base: la más avanzada del historial)
export const agregarEtapa = (pedidoId, e) => db().from("pedido_etapas").insert({
  pedido_id: pedidoId, etapa: e.etapa, fecha: e.fecha || undefined, comentario: texto(e.comentario), visible_cliente: e.visible_cliente !== false
}).then(ok);
export const cambiarEtapa = (id, cambios) => db().from("pedido_etapas").update(cambios).eq("id", id).then(ok);
export const borrarEtapa = id => db().from("pedido_etapas").delete().eq("id", id).then(ok);

// Pagos (positivo = abono del cliente; negativo = devolución)
export const agregarPago = (pedidoId, p) => db().from("pagos").insert({
  pedido_id: pedidoId, fecha: p.fecha || undefined, monto_clp: aPesos(p.monto_clp), medio: texto(p.medio), nota: texto(p.nota)
}).then(ok);
export const borrarPago = id => db().from("pagos").delete().eq("id", id).then(ok);

// Evidencias: fotos comprimidas en el bucket privado; la Admin las ve con links temporales
export async function subirEvidencia(pedidoId, archivo, { visible_cliente = true, pedido_etapa_id = null } = {}) {
  const f = await prepararFoto(archivo);
  const ruta = `${pedidoId}/${Date.now().toString(36)}-${azar()}.${f.ext}`;
  await supabase.storage.from(EVIDENCIAS).upload(ruta, f.grande.blob, { contentType: f.tipo, upsert: false }).then(ok);
  try {
    return await db().from("evidencias").insert({ pedido_id: pedidoId, ruta, visible_cliente, pedido_etapa_id, bytes: f.grande.blob.size }).then(ok);
  } catch (e) { await supabase.storage.from(EVIDENCIAS).remove([ruta]); throw e; }
}
export const cambiarEvidencia = (id, cambios) => db().from("evidencias").update(cambios).eq("id", id).then(ok);
export async function borrarEvidencia(ev) {
  await db().from("evidencias").delete().eq("id", ev.id).then(ok);
  if (ev.ruta) await supabase.storage.from(EVIDENCIAS).remove([ev.ruta]);
}
export async function urlsEvidencias(lista) {
  const rutas = lista.map(e => e.ruta).filter(Boolean);
  const mapa = {};
  if (rutas.length) {
    const firmadas = await supabase.storage.from(EVIDENCIAS).createSignedUrls(rutas, 3600).then(ok);
    for (const x of firmadas) if (x.signedUrl) mapa[x.path] = x.signedUrl;
  }
  return Object.fromEntries(lista.map(e => [e.id, e.ruta ? mapa[e.ruta] || "" : fotoDrive(e.url_externa)]));
}
const fotoDrive = u => {
  const m = String(u || "").match(/\/d\/([\w-]+)/) || String(u || "").match(/[?&]id=([\w-]+)/);
  return m && /google\./.test(u) ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : u || "";
};

// Link y mensaje para el cliente
export const linkSeguimiento = codigo => `${SITIO}/seguimiento.html#${codigo}`;
export const mensajeSeguimiento = p =>
  `¡Hola${p.clientes?.nombre ? " " + p.clientes.nombre.split(" ")[0] : ""}! Aquí puedes ver en qué va tu pedido ${p.codigo} de RINBŌ Ichiba:\n${linkSeguimiento(p.codigo_seguimiento)}\n\nTu código de seguimiento es ${p.codigo_seguimiento} (guárdalo, es solo para ti).`;
export const linkWhatsapp = (numero, mensaje) => `https://wa.me/${limpiarWhatsapp(numero) || ""}?text=${encodeURIComponent(mensaje)}`;

// ============================================================
// Fase 10: resumen por mes y exportación a Excel
// ============================================================
// Todo lo que necesitan el resumen de Inicio y el Excel, en una sola lectura
export async function leerTodo() {
  const [pedidos, items, pagos, clientes, productos] = await Promise.all([
    db().from("pedidos_resumen").select("*").order("creado_en").then(ok),
    db().from("pedido_items").select("*").order("id").then(ok),
    db().from("pagos").select("*").order("fecha").then(ok),
    db().from("clientes").select("*").order("nombre").then(ok),
    db().from("productos").select("*").order("orden").then(ok),
  ]);
  return { pedidos, items, pagos, clientes, productos };
}

// Mes "AAAA-MM" en hora de Chile (así un pedido de las 23:00 no cae en el mes siguiente)
export const mesDe = f => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date(f)).slice(0, 7);
export const nombreMes = m => { const [a, n] = m.split("-"); return ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+n - 1] + " " + a.slice(2); };
export const conCostos = p => p.costo_clp > 0 || p.impuestos_clp > 0;

// Últimos `meses` meses (incluye el actual), aunque no tengan pedidos
export function resumenMensual({ pedidos, pagos }, meses = 12) {
  const hoy = new Date(), lista = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 15));
    lista.push({ mes: d.toISOString().slice(0, 7), pedidos: 0, ventas: 0, ganancia: 0, sinCosto: 0, cobrado: 0 });
  }
  const porMes = Object.fromEntries(lista.map(x => [x.mes, x]));
  for (const p of pedidos) {
    const m = porMes[mesDe(p.creado_en)];
    if (!m) continue;
    m.pedidos++; m.ventas += p.total_clp;
    if (conCostos(p)) m.ganancia += p.utilidad_clp; else if (p.total_clp > 0) m.sinCosto++;
  }
  for (const g of pagos) { const m = porMes[g.fecha.slice(0, 7)]; if (m) m.cobrado += g.monto_clp; }
  return lista;
}

export async function exportarExcel() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const d = await leerTodo();
  const codigo = Object.fromEntries(d.pedidos.map(p => [p.id, p.codigo]));
  const titulo = t => ({ value: t, fontWeight: "bold", backgroundColor: "#F1EFEB" });
  const pesos = v => ({ value: Number(v) || 0, type: Number, format: "$#,##0;-$#,##0" });
  const fecha = v => v ? { value: new Date(v), type: Date, format: "dd-mm-yyyy" } : null;
  const hoja = (nombre, cabecera, filas, anchos) => ({
    sheet: nombre, stickyRowsCount: 1, columns: anchos.map(width => ({ width })),
    data: [cabecera.map(titulo), ...filas],
  });

  const hojas = [
    hoja("Pedidos",
      ["Código", "Fecha", "Cliente", "WhatsApp", "Etapa", "Precio de venta", "Costo", "Impuestos", "Utilidad", "Abonado", "Saldo", "Código de seguimiento", "Información para el cliente", "Notas internas"],
      d.pedidos.map(p => [p.codigo, fecha(p.creado_en), p.cliente_nombre, p.cliente_whatsapp, p.etapa, pesos(p.total_clp), pesos(p.costo_clp),
        pesos(p.impuestos_clp), conCostos(p) ? pesos(p.utilidad_clp) : null, pesos(p.abonado_clp), pesos(p.saldo_clp), p.codigo_seguimiento,
        p.comentarios_generales, p.notas_internas]),
      [10, 12, 24, 16, 20, 14, 12, 12, 12, 12, 12, 16, 40, 40]),
    hoja("Artículos", ["Pedido", "Producto", "Descripción", "Cantidad", "Precio unitario", "Subtotal"],
      d.items.map(i => [codigo[i.pedido_id], i.producto_id, i.descripcion, i.cantidad, pesos(i.precio_unitario_clp), pesos(i.cantidad * i.precio_unitario_clp)]),
      [10, 16, 40, 10, 14, 14]),
    hoja("Pagos", ["Pedido", "Fecha", "Monto", "Medio", "Nota"],
      d.pagos.map(g => [codigo[g.pedido_id], fecha(g.fecha), pesos(g.monto_clp), g.medio, g.nota]),
      [10, 12, 14, 16, 40]),
    hoja("Clientes", ["Nombre", "WhatsApp", "Instagram", "Correo", "Ciudad", "Pedidos", "Notas", "Creado"],
      d.clientes.map(c => [c.nombre, c.whatsapp, c.instagram, c.email, c.ciudad, d.pedidos.filter(p => p.cliente_id === c.id).length, c.notas, fecha(c.creado_en)]),
      [24, 16, 18, 24, 16, 9, 40, 12]),
    hoja("Productos", ["Código", "Nombre", "Categoría", "Subcategoría", "Marca", "Estado", "Precio", "Oferta", "Stock", "Publicado", "Destacado"],
      d.productos.map(p => [p.id, p.nombre, p.categoria_principal, p.categoria_secundaria, p.marca, p.estado, pesos(p.precio_clp),
        p.precio_oferta ? pesos(p.precio_oferta) : null, p.stock, p.publicado ? "Sí" : "No", p.destacado ? "Sí" : "No"]),
      [16, 40, 16, 16, 14, 12, 12, 12, 12, 10, 10]),
    hoja("Resumen por mes", ["Mes", "Pedidos", "Ventas", "Ganancia (pedidos con costos)", "Pedidos sin costo", "Cobrado"],
      resumenMensual(d, 24).map(m => [nombreMes(m.mes), m.pedidos, pesos(m.ventas), pesos(m.ganancia), m.sinCosto, pesos(m.cobrado)]),
      [10, 9, 14, 24, 16, 14]),
  ];
  const nombre = `RINBO-respaldo-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await writeXlsxFile(hojas, { fontFamily: "Calibri", fontSize: 11 }).toFile(nombre);
  return nombre;
}
