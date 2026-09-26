// Edge Function "whatsapp-webhook" (fase 8): recibe de YCloud los mensajes del WhatsApp de la tienda
// (coexistencia con la app WhatsApp Business): guarda cada aviso completo en rinbo.whatsapp_eventos (respaldo) y sus
// mensajes en rinbo.whatsapp_mensajes. Solo lectura: nunca envía nada.
//   URL para YCloud: https://mgxljvxjonopchpvmjkl.supabase.co/functions/v1/whatsapp-webhook
// Seguridad: cada aviso trae la cabecera "YCloud-Signature: t=<segundos>,s=<hex>" = HMAC-SHA256("<t>.<cuerpo>", secreto).
// El secreto lo pone el dueño en Supabase → Edge Functions → Secrets como YCLOUD_WEBHOOK_SECRET (nunca va al repo ni al chat).
// Número de la tienda (para saber qué mensajes son "salientes"): secreto opcional TIENDA_WHATSAPP; por defecto el de rinbo.js.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
function llaveServidor(): string {
  const legado = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legado) return legado;
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { return ""; }
}
const LLAVE = llaveServidor();
const SECRETO = Deno.env.get("YCLOUD_WEBHOOK_SECRET") || "";
const TIENDA = (Deno.env.get("TIENDA_WHATSAPP") || "819039343820").replace(/\D/g, "");
const TOLERANCIA_SEG = 60 * 60 * 24; // YCloud reintenta avisos fallidos durante horas

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

async function firmaValida(cabecera: string, cuerpo: string) {
  if (!SECRETO) return false;
  const partes = Object.fromEntries(cabecera.split(",").map(p => p.trim().split("=", 2)));
  const t = partes.t, s = (partes.s || "").toLowerCase();
  if (!t || !s || Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCIA_SEG) return false;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRETO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(`${t}.${cuerpo}`)));
  const esperado = [...firma].map(b => b.toString(16).padStart(2, "0")).join("");
  if (esperado.length !== s.length) return false;
  let dif = 0;
  for (let i = 0; i < s.length; i++) dif |= esperado.charCodeAt(i) ^ s.charCodeAt(i);
  return dif === 0;
}

// El mensaje puede venir en distintas propiedades (whatsappInboundMessage, whatsappMessage…) y, en el historial
// que Meta envía al conectar (whatsapp.smb.history), a veces dentro de listas: se buscan en todo el aviso
// los objetos que tengan "wamid". Se recuerda el nombre de la propiedad para saber si es enviado o recibido.
type Msg = Record<string, any>;
function mensajesDe(nodo: unknown, clave = "", res: { m: Msg; clave: string }[] = [], prof = 0) {
  if (!nodo || typeof nodo !== "object" || prof > 8) return res;
  if (Array.isArray(nodo)) { nodo.forEach(x => mensajesDe(x, clave, res, prof + 1)); return res; }
  const obj = nodo as Msg;
  if (typeof obj.wamid === "string" && obj.wamid) { res.push({ m: obj, clave }); return res; }
  for (const [k, v] of Object.entries(obj)) if (v && typeof v === "object") mensajesDe(v, k, res, prof + 1);
  return res;
}

function textoDe(m: Msg): string | null {
  const t = m.type;
  const c = m[t] || {};
  if (t === "text") return m.text?.body ?? null;
  if (t === "reaction") return c.emoji ? `Reaccionó ${c.emoji}` : null;
  if (t === "location") return [c.name, c.address].filter(Boolean).join(" · ") || "Ubicación";
  if (t === "button") return c.text ?? null;
  if (t === "interactive") return c.button_reply?.title || c.list_reply?.title || c.nfm_reply?.body || null;
  if (t === "contacts") return (m.contacts || []).map((x: Msg) => x.name?.formatted_name).filter(Boolean).join(", ") || null;
  return c.caption || c.filename || c.body || null;
}

function aFila(m: Msg, tipoEvento: string, clave: string) {
  const de = digitos(m.from), para = digitos(m.to);
  const saliente = tipoEvento.includes("echo") || tipoEvento.includes("sent") || (de === TIENDA && para !== TIENDA)
    || (!de && !!para && para !== TIENDA)          // sin remitente y el destinatario es el cliente
    || (/outbound|^whatsappMessage$/i.test(clave) && para !== TIENDA);
  const telefono = saliente ? para : de;
  if (!telefono || telefono === TIENDA) return null;
  // Fecha original del mensaje (en el historial, createTime puede ser la fecha de la sincronización)
  const cuando = m.sendTime || m.timestamp || m.deliverTime || m.createTime;
  const fecha = cuando ? new Date(/^\d+$/.test(String(cuando)) ? Number(cuando) * 1000 : cuando) : new Date();
  return {
    wamid: String(m.wamid),
    telefono,
    nombre_perfil: saliente ? null : (m.customerProfile?.name || m.profile?.name || null),
    direccion: saliente ? "saliente" : "entrante",
    tipo: String(m.type || "text"),
    texto: textoDe(m),
    enviado_en: isNaN(fecha.getTime()) ? new Date().toISOString() : fecha.toISOString(),
    evento: tipoEvento,
  };
}

Deno.serve(async (req) => {
  if (req.method === "GET") return responder({ ok: true, servicio: "whatsapp-webhook" });
  if (req.method !== "POST") return responder({ error: "metodo" }, 405);
  const cuerpo = await req.text();
  if (!(await firmaValida(req.headers.get("ycloud-signature") || "", cuerpo))) {
    console.warn("firma inválida o falta YCLOUD_WEBHOOK_SECRET");
    return responder({ error: "firma" }, 401);
  }
  let evento: Msg;
  try { evento = JSON.parse(cuerpo); } catch { return responder({ error: "json" }, 400); }
  const tipoEvento = String(evento.type || "");

  // Respaldo del aviso + sus mensajes en UNA sola llamada (rinbo.guardar_aviso_whatsapp). Si la base no responde a
  // tiempo se contesta 503 y YCloud reintenta más tarde (así una avalancha, como el historial, no la satura).
  const filas = mensajesDe(evento).map(x => aFila(x.m, tipoEvento, x.clave)).filter(Boolean);
  // Hasta 4 intentos dentro de la misma llamada (esperas de 0,5 s, 1,5 s y 3 s) antes de pedirle a YCloud que reintente
  const cuerpoRpc = JSON.stringify({ p_evento_id: evento.id ? String(evento.id) : null, p_tipo: tipoEvento, p_crudo: evento, p_mensajes: filas });
  let guardados: unknown = null, ultimoError = "";
  for (const espera of [0, 500, 1500, 3000]) {
    if (espera) await new Promise(res => setTimeout(res, espera));
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/rpc/guardar_aviso_whatsapp`, {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: {
          apikey: LLAVE, ...(LLAVE.startsWith("sb_") ? {} : { Authorization: `Bearer ${LLAVE}` }),
          "Content-Type": "application/json", "Content-Profile": "rinbo",
        },
        body: cuerpoRpc,
      });
      if (r.ok) { guardados = await r.json(); ultimoError = ""; break; }
      ultimoError = `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
      if (r.status < 500 && r.status !== 429) break;   // error de datos: reintentar no sirve
    } catch (e) { ultimoError = String(e); }
  }
  if (ultimoError) { console.error("guardar", ultimoError); return responder({ error: "ocupado" }, 503); }
  return responder({ ok: true, guardados, evento: tipoEvento });
});
