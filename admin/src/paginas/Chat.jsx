import { useEffect, useRef, useState } from "react";
import { listarMensajes, listarConversaciones, borrarConversacion, estadosChats, marcarLeido, marcarNoLeido, ocultarChat, estaOculto, linkWhatsapp, mensajeError } from "../lib/datos.js";
import EtapasChat from "../lib/EtapasChat.jsx";
import { ir, Cargando, fechaCorta } from "../lib/ui.jsx";
import { resumenTipo } from "./Mensajes.jsx";

export default function Chat({ telefono }) {
  const [mensajes, setMensajes] = useState(null);
  const [conv, setConv] = useState(null);
  const [error, setError] = useState("");
  const caja = useRef(null);
  const noLeidoManual = useRef(false);   // si lo marcas "no leído" estando dentro, no se vuelve a marcar leído solo
  const [estado, setEstado] = useState(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => { estadosChats().then(st => setEstado(st[telefono] || {})).catch(() => setEstado({})); }, [telefono]);
  const avisar = t => { setAviso(t); setTimeout(() => setAviso(a => a === t ? "" : a), 2500); };
  const abajo = useRef(true);

  useEffect(() => {
    const cargar = () => Promise.all([listarMensajes(telefono), listarConversaciones()])
      .then(([m, cs]) => { setMensajes(m); setConv(cs.find(c => c.telefono === telefono) || null); if (m.length && !noLeidoManual.current) marcarLeido(telefono, cs.find(c => c.telefono === telefono)?.ultimo_en || m[m.length - 1].enviado_en).catch(() => {}); })
      .catch(e => setError(mensajeError(e)));
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [telefono]);
  // Abre en el último mensaje (como en el teléfono); si llegan mensajes nuevos, baja solo si ya estabas abajo
  useEffect(() => {
    const c = caja.current;
    if (c && abajo.current) c.scrollTop = c.scrollHeight;
  }, [mensajes?.length]);
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const alMover = () => { abajo.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80; };
    c.addEventListener("scroll", alMover, { passive: true });
    return () => c.removeEventListener("scroll", alMover);
  }, [!!mensajes]);

  if (error && !mensajes) return <main className="pagina"><p className="aviso error">{error}</p><a className="enlace" href="#/mensajes">← Mensajes</a></main>;
  if (!mensajes) return <Cargando />;

  const nombre = conv?.cliente_nombre || conv?.nombre_perfil || "+" + telefono;
  let diaAnterior = "";
  return (
    <main className="pagina chat-pagina">
      <header className="chat-cabecera">
        <div className="chat-titulo">
          <a className="volver" href="#/mensajes" aria-label="Volver a Mensajes">←</a>
          <div>
            <h1>{nombre}</h1>
            <p className="sobre num">+{telefono}{conv?.nombre_perfil && conv?.cliente_nombre ? ` · en WhatsApp: ${conv.nombre_perfil}` : ""}</p>
          </div>
        </div>
        <div className="botones">
          {conv?.cliente_id
            ? <a className="btn chico" href={`#/clientes/${conv.cliente_id}`}>Ver cliente y pedidos</a>
            : <a className="btn principal chico" href={`#/clientes/nuevo?whatsapp=${telefono}&nombre=${encodeURIComponent(conv?.nombre_perfil || "")}&volver=${encodeURIComponent("/mensajes/" + telefono)}`}>+ Crear cliente</a>}
          <a className="btn chico" href={linkWhatsapp(telefono, "")} target="_blank" rel="noopener">Responder en WhatsApp</a>
        </div>
        {estado && conv && (
          <div className="botones acciones-estado">
            <button className="enlace" onClick={async () => {
              const o = !estaOculto(conv, estado);
              try { await ocultarChat(telefono, o); setEstado(e => ({ ...e, oculto: o })); avisar(o ? "Chat ocultado" : "Chat visible otra vez"); } catch (e) { setError(mensajeError(e)); }
            }}>{estaOculto(conv, estado) ? "👁 Mostrar chat" : "🙈 Ocultar chat"}</button>
            <button className="enlace" onClick={async () => {
              try { await marcarNoLeido(telefono); noLeidoManual.current = true; setEstado(e => ({ ...e, no_leido: true })); avisar("Marcado como no leído"); } catch (e) { setError(mensajeError(e)); }
            }}>● Marcar como no leído</button>
          </div>
        )}
        {aviso && <p className="aviso ok">{aviso}</p>}
        <EtapasChat telefono={telefono} />
        {error && <p className="aviso error">{error}</p>}
      </header>
      <div className="chat-scroll" ref={caja}>
        <div className="chat-inicio">
          <p className="ayuda">Inicio de la copia de este chat. Las fotos, audios y videos no se copian aquí: se ven en tu app de WhatsApp.</p>
          <button className="enlace" onClick={async () => {
            if (!confirm("¿Borrar de la Admin la copia de este chat? (En tu WhatsApp no se borra nada.)")) return;
            try { await borrarConversacion(telefono); ir("/mensajes"); } catch (e) { setError(mensajeError(e)); }
          }}>Borrar copia de este chat</button>
        </div>
        <ol className="chat">
          {mensajes.map(m => {
            const dia = fechaCorta(new Date(m.enviado_en).toISOString());
            const sep = dia !== diaAnterior; diaAnterior = dia;
            return (
              <li key={m.id} className={m.tipo === "unsupported" ? "sistema" : m.direccion}>
                {sep && <span className="dia num">{dia}</span>}
                <div className="burbuja">
                  {m.tipo !== "text" && <small className="tipo">{resumenTipo(m.tipo, "")}</small>}
                  {m.texto && <p>{m.texto}</p>}
                  <time className="num">{new Date(m.enviado_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
