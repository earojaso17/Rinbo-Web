// Cloudflare Pages Function (corre en Cloudflare, no en el navegador): botón "Publicar cambios ahora" de RINBŌ Admin.
// POST /api/publicar → pide a GitHub que corra ya el robot del catálogo (workflow pages.yml en main).
// GET  /api/publicar → estado de la última publicación pedida desde aquí.
// Seguridad: (1) Cloudflare Access protege todo rinbo-admin.pages.dev; (2) aquí se exige la sesión de Supabase
// de un administrador (rinbo.es_admin()); (3) el token de GitHub vive solo como secreto de Cloudflare (GITHUB_TOKEN)
// y nunca llega al navegador. El token solo necesita permiso "Actions: Read and write" sobre el repo Rinbo-Web.
import { SUPABASE_URL, SUPABASE_LLAVE_PUBLICA } from "../../src/config.js";

const REPO = "earojaso17/Rinbo-Web";
const WORKFLOW = "pages.yml";
const gh = (env, ruta, opciones = {}) => fetch(`https://api.github.com/repos/${REPO}${ruta}`, {
  ...opciones,
  headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "rinbo-admin", ...(opciones.headers || {}) }
});
const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

async function esAdmin(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/es_admin`, {
    method: "POST", body: "{}",
    headers: { apikey: SUPABASE_LLAVE_PUBLICA, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Profile": "rinbo" }
  });
  return r.ok && (await r.json()) === true;
}

async function ultimaCorrida(env) {
  const r = await gh(env, `/actions/workflows/${WORKFLOW}/runs?branch=main&event=workflow_dispatch&per_page=1`);
  if (!r.ok) return null;
  const run = (await r.json()).workflow_runs?.[0];
  return run ? { estado: run.status, resultado: run.conclusion, creado: run.created_at, actualizado: run.updated_at } : null;
}

export async function onRequest({ request, env }) {
  if (!env.GITHUB_TOKEN) return respuesta({ error: "Falta configurar el secreto GITHUB_TOKEN en Cloudflare." }, 503);
  if (!(await esAdmin(request))) return respuesta({ error: "Solo administradores." }, 403);

  if (request.method === "GET") return respuesta({ ultima: await ultimaCorrida(env) });

  if (request.method === "POST") {
    const ultima = await ultimaCorrida(env);
    if (ultima && ultima.estado !== "completed") return respuesta({ ok: true, yaEnCurso: true, ultima });
    const r = await gh(env, `/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST", body: JSON.stringify({ ref: "main" }), headers: { "Content-Type": "application/json" }
    });
    if (r.status !== 204) return respuesta({ error: `GitHub respondió ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
    return respuesta({ ok: true, pedido: new Date().toISOString() });
  }
  return respuesta({ error: "Método no permitido." }, 405);
}
