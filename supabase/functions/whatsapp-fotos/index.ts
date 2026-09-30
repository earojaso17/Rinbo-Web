// Edge Function "whatsapp-fotos" (fase 8): baja las fotos de WhatsApp desde YCloud y las guarda en la carpeta
// privada "whatsapp" de Supabase (rinbo.whatsapp_mensajes.media_ruta). La Admin las muestra con links temporales.
// YCloud manda en cada foto un link firmado que vence: por eso "whatsapp-webhook" llama a esta función apenas llega
// una foto. Cada llamada procesa además las pendientes que hayan quedado (hasta 25), así que se repara sola.
// Las fotos se guardan tal cual: WhatsApp ya las comprime (llegan de 40 a 150 KB).
// Quién puede llamarla: el servidor (llave de servicio, la usa whatsapp-webhook) o un administrador con sesión.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
function llaveServidor(): string {
  const legado = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legado) return legado;
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { return ""; }
}
const LLAVE = llaveServidor();
const CABECERAS = { apikey: LLAVE, ...(LLAVE.startsWith("sb_") ? {} : { Authorization: `Bearer ${LLAVE}` }) };
const CARPETA = "whatsapp", MAX_BYTES = 5 * 1024 * 1024, MAX_INTENTOS = 5, POR_VUELTA = 25;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

async function autorizado(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === LLAVE) return true;
  // ¿Es otra llave de servidor válida (formato antiguo o nuevo)? Solo esas pueden listar usuarios de Auth.
  const s = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: token, ...(token.startsWith("sb_") ? {} : { Authorization: `Bearer ${token}` }) },
  }).catch(() => null);
  if (s?.ok) return true;
  await s?.body?.cancel();
  // ¿Es un administrador con sesión? (rinbo.es_admin con su propio token)
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/es_admin`, {
    method: "POST", headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Profile": "rinbo" }, body: "{}",
  }).catch(() => null);
  return !!r?.ok && (await r.json()) === true;
}

type Fila = { id: number; wamid: string; telefono: string; media_links: string[]; media_intentos: number };

async function actualizar(id: number, cambios: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/rest/v1/whatsapp_mensajes?id=eq.${id}`, {
    method: "PATCH", headers: { ...CABECERAS, "Content-Type": "application/json", "Content-Profile": "rinbo", Prefer: "return=minimal" },
    body: JSON.stringify(cambios),
  });
  if (!r.ok) throw new Error(`actualizar ${r.status} ${await r.text()}`);
}

// Nombre del archivo sin caracteres raros: <teléfono>/<id del mensaje>.<ext>
const nombreArchivo = (f: Fila, ext: string) => `${f.telefono}/${f.id}.${ext}`;

async function guardarFoto(f: Fila): Promise<string> {
  let vencidos = 0, ultimoError = "";
  for (const link of [...f.media_links].reverse()) {           // el más nuevo primero
    try {
      const r = await fetch(link, { signal: AbortSignal.timeout(15000) });
      if (r.status === 404 || r.status === 410 || r.status === 400) { vencidos++; await r.body?.cancel(); continue; }
      if (!r.ok) { ultimoError = `HTTP ${r.status}`; await r.body?.cancel(); continue; }
      const tipo = (r.headers.get("content-type") || "").split(";")[0].trim();
      const datos = new Uint8Array(await r.arrayBuffer());
      if (!EXT[tipo]) { ultimoError = `tipo ${tipo}`; continue; }
      if (datos.byteLength > MAX_BYTES) { await actualizar(f.id, { media_estado: "error" }); return "muy grande"; }
      const ruta = nombreArchivo(f, EXT[tipo]);
      const s = await fetch(`${URL_BASE}/storage/v1/object/${CARPETA}/${ruta}`, {
        method: "POST", headers: { ...CABECERAS, "Content-Type": tipo, "x-upsert": "true" }, body: datos,
      });
      if (!s.ok) { ultimoError = `subir ${s.status} ${(await s.text()).slice(0, 200)}`; continue; }
      await actualizar(f.id, { media_ruta: ruta, media_estado: "guardada" });
      return "guardada";
    } catch (e) { ultimoError = String(e); }
  }
  if (vencidos === f.media_links.length) { await actualizar(f.id, { media_estado: "vencida" }); return "vencida"; }
  const intentos = f.media_intentos + 1;
  await actualizar(f.id, { media_intentos: intentos, ...(intentos >= MAX_INTENTOS ? { media_estado: "error" } : {}) });
  console.error("foto", f.wamid, ultimoError);
  return "reintentar";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder({ error: "metodo" }, 405);
  if (!(await autorizado(req))) return responder({ error: "no autorizado" }, 401);
  const r = await fetch(`${URL_BASE}/rest/v1/whatsapp_mensajes?select=id,wamid,telefono,media_links,media_intentos` +
    `&media_links=not.is.null&media_estado=is.null&order=id.desc&limit=${POR_VUELTA}`, { headers: { ...CABECERAS, "Accept-Profile": "rinbo" } });
  if (!r.ok) return responder({ error: `leer ${r.status}` }, 503);
  const filas: Fila[] = await r.json();
  const resultado: Record<string, number> = {};
  for (const f of filas) {                                       // de a una: son pocas y así no se satura nada
    const estado = await guardarFoto(f).catch(e => { console.error("foto", f.wamid, String(e)); return "reintentar"; });
    resultado[estado] = (resultado[estado] || 0) + 1;
  }
  return responder({ ok: true, revisadas: filas.length, ...resultado });
});
