// Edge Function "whatsapp-webhook" (fase 8): recibe de YCloud los mensajes del WhatsApp de la tienda
// (coexistencia con la app WhatsApp Business) y los guarda en rinbo.whatsapp_mensajes. Solo lectura: nunca envía nada.
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

// El mensaje viene en una propiedad distinta según el aviso (whatsappInboundMessage, whatsappMessage…):
// se toma el primer objeto que tenga "wamid".
type Msg = Record<string, any>;
function mensajesDe(evento: Msg): Msg[] {
  const res: Msg[] = [];
  for (const v of Object.values(evento)) {
    if (Array.isArray(v)) v.forEach(x => x && typeof x === "object" && x.wamid && res.push(x));
    else if (v && typeof v === "object" && (v as Msg).wamid) res.push(v as Msg);
  }
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

function aFila(m: Msg, tipoEvento: string) {
  const de = digitos(m.from), para = digitos(m.to);
  const saliente = tipoEvento.includes("echo") || tipoEvento.includes("sent") || (de === TIENDA && para !== TIENDA);
  const telefono = saliente ? para : de;
  if (!telefono || telefono === TIENDA) return null;
  const cuando = m.sendTime || m.createTime || m.timestamp;
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
    crudo: m,
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
  const filas = mensajesDe(evento).map(m => aFila(m, tipoEvento)).filter(Boolean);
  if (!filas.length) return responder({ ok: true, guardados: 0, evento: tipoEvento });

  const r = await fetch(`${URL_BASE}/rest/v1/whatsapp_mensajes?on_conflict=wamid`, {
    method: "POST",
    headers: {
      apikey: LLAVE, ...(LLAVE.startsWith("sb_") ? {} : { Authorization: `Bearer ${LLAVE}` }),
      "Content-Type": "application/json", "Content-Profile": "rinbo", Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(filas),
  });
  if (!r.ok) { console.error("guardar", r.status, await r.text()); return responder({ error: "guardar" }, 500); }
  return responder({ ok: true, guardados: filas.length });
});
