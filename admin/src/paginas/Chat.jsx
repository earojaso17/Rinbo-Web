import { useEffect, useRef, useState } from "react";
import { listarMensajes, listarConversaciones, borrarConversacion, marcarVisto, linkWhatsapp, mensajeError } from "../lib/datos.js";
import { ir, Cargando, fechaCorta } from "../lib/ui.jsx";
import { resumenTipo } from "./Mensajes.jsx";

export default function Chat({ telefono }) {
  const [mensajes, setMensajes] = useState(null);
  const [conv, setConv] = useState(null);
  const [error, setError] = useState("");
  const fin = useRef(null);

  useEffect(() => {
    const cargar = () => Promise.all([listarMensajes(telefono), listarConversaciones()])
      .then(([m, cs]) => { setMensajes(m); setConv(cs.find(c => c.telefono === telefono) || null); if (m.length) marcarVisto(telefono, cs.find(c => c.telefono === telefono)?.ultimo_en || m[m.length - 1].enviado_en); })
      .catch(e => setError(mensajeError(e)));
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [telefono]);
  useEffect(() => { fin.current?.scrollIntoView(); }, [mensajes?.length]);

  if (error && !mensajes) return <main className="pagina"><p className="aviso error">{error}</p><a className="enlace" href="#/mensajes">← Mensajes</a></main>;
  if (!mensajes) return <Cargando />;

  const nombre = conv?.cliente_nombre || conv?.nombre_perfil || "+" + telefono;
  let diaAnterior = "";
  return (
    <main className="pagina">
      <a className="enlace" href="#/mensajes">← Mensajes</a>
      <div className="cabecera">
        <div>
          <h1 className="titulo">{nombre}</h1>
          <p className="sobre num">+{telefono}{conv?.nombre_perfil && conv?.cliente_nombre ? ` · en WhatsApp: ${conv.nombre_perfil}` : ""}</p>
        </div>
      </div>
      <div className="botones">
        {conv?.cliente_id
          ? <a className="btn chico" href={`#/clientes/${conv.cliente_id}`}>Ver cliente y pedidos</a>
          : <a className="btn principal chico" href={`#/clientes/nuevo?whatsapp=${telefono}&nombre=${encodeURIComponent(conv?.nombre_perfil || "")}`}>+ Crear cliente</a>}
        <a className="btn chico" href={linkWhatsapp(telefono, "")} target="_blank" rel="noopener">Responder en WhatsApp</a>
      </div>
      <ol className="chat">
        {mensajes.map(m => {
          const dia = fechaCorta(new Date(m.enviado_en).toISOString());
          const sep = dia !== diaAnterior; diaAnterior = dia;
          return (
            <li key={m.id} className={m.direccion}>
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
      <div ref={fin} />
      <p className="ayuda">Las fotos, audios y videos no se copian aquí (ocupan mucho espacio): se ven en tu app de WhatsApp.</p>
      <button className="enlace" onClick={async () => {
        if (!confirm("¿Borrar de la Admin la copia de este chat? (En tu WhatsApp no se borra nada.)")) return;
        try { await borrarConversacion(telefono); ir("/mensajes"); } catch (e) { setError(mensajeError(e)); }
      }}>Borrar copia de este chat</button>
    </main>
  );
}
