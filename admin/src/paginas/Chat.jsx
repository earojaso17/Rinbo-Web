import { useEffect, useRef, useState } from "react";
import { listarMensajes, listarConversaciones, borrarConversacion, marcarVisto, linkWhatsapp, listarEtiquetas, etiquetasDeChats, ponerEtiqueta, quitarEtiqueta, mensajeError } from "../lib/datos.js";
import Etiqueta from "../lib/Etiqueta.jsx";
import { ir, Cargando, fechaCorta } from "../lib/ui.jsx";
import { resumenTipo } from "./Mensajes.jsx";

export default function Chat({ telefono }) {
  const [mensajes, setMensajes] = useState(null);
  const [conv, setConv] = useState(null);
  const [error, setError] = useState("");
  const caja = useRef(null);
  const abajo = useRef(true);
  const [etiquetas, setEtiquetas] = useState([]);
  const [mias, setMias] = useState([]);
  useEffect(() => {
    Promise.all([listarEtiquetas(), etiquetasDeChats()]).then(([e, a]) => { setEtiquetas(e); setMias(a[telefono] || []); }).catch(() => {});
  }, [telefono]);
  async function alternar(id) {
    const tiene = mias.includes(id);
    setMias(m => tiene ? m.filter(x => x !== id) : [...m, id]);
    try { tiene ? await quitarEtiqueta(telefono, id) : await ponerEtiqueta(telefono, id); }
    catch (e) { setError(mensajeError(e)); setMias(m => tiene ? [...m, id] : m.filter(x => x !== id)); }
  }

  useEffect(() => {
    const cargar = () => Promise.all([listarMensajes(telefono), listarConversaciones()])
      .then(([m, cs]) => { setMensajes(m); setConv(cs.find(c => c.telefono === telefono) || null); if (m.length) marcarVisto(telefono, cs.find(c => c.telefono === telefono)?.ultimo_en || m[m.length - 1].enviado_en); })
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
            : <a className="btn principal chico" href={`#/clientes/nuevo?whatsapp=${telefono}&nombre=${encodeURIComponent(conv?.nombre_perfil || "")}`}>+ Crear cliente</a>}
          <a className="btn chico" href={linkWhatsapp(telefono, "")} target="_blank" rel="noopener">Responder en WhatsApp</a>
        </div>
        {etiquetas.length > 0 && (
          <div className="chips etiquetas-chat" aria-label="Etiquetas del chat">
            {etiquetas.map(e => <Etiqueta key={e.id} etiqueta={e} activa={mias.includes(e.id)} onClick={() => alternar(e.id)} />)}
            <a className="enlace" href="#/etiquetas">Editar</a>
          </div>
        )}
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
