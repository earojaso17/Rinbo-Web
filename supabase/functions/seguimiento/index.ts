// Edge Function "seguimiento" (fase 6): lo que consulta rinbo.store/seguimiento.html.
//   POST https://mgxljvxjonopchpvmjkl.supabase.co/functions/v1/seguimiento   {"codigo": "K7QMX-4PAR9"}
// Usa la llave de servidor (solo existe aquí, dentro de Supabase) para:
//   1) llamar a rinbo.seguimiento_publico(código, huella de la IP): datos visibles del pedido + límite de intentos;
//   2) crear links temporales (1 hora) de las fotos de evidencia del bucket privado "evidencias".
// Se publica sin exigir sesión (verify_jwt = false): cualquiera puede preguntar, pero solo con el código secreto.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
function llaveServidor(): string {
  const legado = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legado) return legado;
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { return ""; }
}
const LLAVE = llaveServidor();
const cabeceras = (extra: Record<string, string> = {}) => ({
  apikey: LLAVE,
  ...(LLAVE.startsWith("sb_") ? {} : { Authorization: `Bearer ${LLAVE}` }),
  "Content-Type": "application/json",
  ...extra,
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Max-Age": "86400",
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function huella(texto: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("rinbo-seguimiento|" + texto));
  return [...new Uint8Array(b)].slice(0, 16).map(x => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return responder({ error: "metodo" }, 405);

  let codigo = "";
  try { codigo = String((await req.json())?.codigo || "").slice(0, 40); } catch { /* cuerpo inválido */ }
  if (!codigo.trim()) return responder({ error: "no_encontrado" }, 404);

  const ip = req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sin-ip";
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/seguimiento_publico`, {
    method: "POST",
    headers: cabeceras({ "Content-Profile": "rinbo" }),
    body: JSON.stringify({ p_codigo: codigo, p_ip: await huella(ip) }),
  });
  if (!r.ok) { console.error("rpc", r.status, await r.text()); return responder({ error: "servidor" }, 500); }
  const p = await r.json();
  if (p?.error === "demasiados") return responder(p, 429);
  if (!p || p.error) return responder({ error: "no_encontrado" }, 404);

  // Links temporales para las fotos del bucket privado; las de Google Drive (importadas) van tal cual
  const rutas = (p.evidencias || []).map((e: { ruta?: string }) => e.ruta).filter(Boolean);
  const firmadas = new Map<string, string>();
  if (rutas.length) {
    const s = await fetch(`${URL_BASE}/storage/v1/object/sign/evidencias`, {
      method: "POST", headers: cabeceras(), body: JSON.stringify({ expiresIn: 3600, paths: rutas }),
    });
    if (s.ok) {
      for (const x of await s.json()) if (x.signedURL) firmadas.set(x.path, `${URL_BASE}/storage/v1${x.signedURL}`);
    } else console.error("firmar", s.status, await s.text());
  }
  p.evidencias = (p.evidencias || [])
    .map((e: { ruta?: string; url?: string; descripcion?: string }) => ({ url: e.ruta ? firmadas.get(e.ruta) : e.url, descripcion: e.descripcion || "" }))
    .filter((e: { url?: string }) => e.url);

  return responder(p);
});
