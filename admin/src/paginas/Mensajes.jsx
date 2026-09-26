import { useEffect, useMemo, useState } from "react";
import { listarConversaciones, vistos, mensajeError } from "../lib/datos.js";
import { fechaCorta } from "../lib/ui.jsx";

const TIPOS = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", sticker: "Sticker", document: "📄 Documento", location: "📍 Ubicación", contacts: "👤 Contacto", reaction: "Reacción" };
export const resumenTipo = (tipo, texto) => texto ? (TIPOS[tipo] && tipo !== "reaction" ? `${TIPOS[tipo]} · ${texto}` : texto) : TIPOS[tipo] || "Mensaje";
export const hora = f => {
  const d = new Date(f), hoy = new Date();
  return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : fechaCorta(d.toISOString());
};

export default function Mensajes() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [soloNuevos, setSoloNuevos] = useState(false);
  const leidos = vistos();

  useEffect(() => {
    const cargar = () => listarConversaciones().then(setLista).catch(e => setError(mensajeError(e)));
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  const nuevo = c => c.ultima_direccion === "entrante" && (!leidos[c.telefono] || leidos[c.telefono] < c.ultimo_en);
  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (lista || []).filter(c => !soloNuevos || nuevo(c))
      .filter(c => !t || [c.telefono, c.nombre_perfil, c.cliente_nombre, c.ultimo_texto].join(" ").toLowerCase().includes(t));
  }, [lista, texto, soloNuevos]);

  return (
    <main className="pagina">
      <h1 className="titulo">Mensajes</h1>
      <p className="ayuda">Copia de tu WhatsApp (solo lectura). Responde desde tu app de WhatsApp Business como siempre.</p>
      <input className="buscar" type="search" placeholder="Buscar por nombre, número o texto…" value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="chips">
        <button className="chip" aria-pressed={!soloNuevos} onClick={() => setSoloNuevos(false)}>Todos{lista && <span className="num"> {lista.length}</span>}</button>
        <button className="chip" aria-pressed={soloNuevos} onClick={() => setSoloNuevos(true)}>Sin leer{lista && <span className="num"> {lista.filter(nuevo).length}</span>}</button>
      </div>
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && !visibles.length && (
        <div className="vacio"><span className="jp">無</span>
          <p>{lista.length ? "Nada con ese filtro." : "Aún no llegan mensajes. Aparecerán aquí cuando WhatsApp esté conectado con YCloud."}</p></div>
      )}
      <ul className="lista">
        {visibles.map(c => (
          <li key={c.telefono} className={"item" + (nuevo(c) ? " nuevo" : "")}>
            <a className="item-link" href={`#/mensajes/${c.telefono}`}>
              <span className="paso jp">{(c.cliente_nombre || c.nombre_perfil || "#").trim()[0]?.toUpperCase()}</span>
              <span className="item-texto">
                <b>{c.cliente_nombre || c.nombre_perfil || "+" + c.telefono}{c.cliente_nombre && <span className="etiqueta cl">Cliente</span>}</b>
                <small>{c.ultima_direccion === "saliente" ? "Tú: " : ""}{resumenTipo(c.ultimo_tipo, c.ultimo_texto)}</small>
                <small className="num">{hora(c.ultimo_en)} · {c.mensajes} mensaje(s)</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
