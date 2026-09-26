import { useEffect, useMemo, useState } from "react";
import { listarConversaciones, listarEtiquetas, etiquetasDeChats, vistos, COLORES_ETIQUETA, mensajeError } from "../lib/datos.js";
import { fechaCorta } from "../lib/ui.jsx";
import Etiqueta from "../lib/Etiqueta.jsx";

const TIPOS = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", sticker: "Sticker", document: "📄 Documento", location: "📍 Ubicación",
  contacts: "👤 Contacto", reaction: "Reacción", edit: "✏️ Mensaje editado", unsupported: "Aviso de WhatsApp" };
export const resumenTipo = (tipo, texto) => texto ? (TIPOS[tipo] && tipo !== "reaction" ? `${TIPOS[tipo]} · ${texto}` : texto) : TIPOS[tipo] || "Mensaje";
export const hora = f => {
  const d = new Date(f), hoy = new Date();
  return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : fechaCorta(d.toISOString());
};
// Conversación real = el cliente escribió algo (sin esto son difusiones o avisos automáticos de WhatsApp)
const esConversacion = c => c.entrantes > 0;

export default function Mensajes() {
  const [lista, setLista] = useState(null);
  const [etiquetas, setEtiquetas] = useState([]);
  const [asignadas, setAsignadas] = useState({});
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("conversaciones");
  const [etiqueta, setEtiqueta] = useState(null);   // etiqueta libre elegida
  const [etapa, setEtapa] = useState(null);         // id de etapa, "sin" = sin etapa, null = todas
  const leidos = vistos();

  useEffect(() => {
    const cargar = () => Promise.all([listarConversaciones(), listarEtiquetas(), etiquetasDeChats()])
      .then(([l, e, a]) => { setLista(l); setEtiquetas(e); setAsignadas(a); })
      .catch(e => setError(mensajeError(e)));
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  const etapaDe = c => (asignadas[c.telefono] || []).map(id => etiquetas.find(e => e.id === id)).find(e => e?.es_etapa);
  const nuevo = c => c.ultima_direccion === "entrante" && (!leidos[c.telefono] || leidos[c.telefono] < c.ultimo_en);
  const FILTROS = [["conversaciones", "Conversaciones", esConversacion], ["sinleer", "Sin leer", nuevo], ["todos", "Todos", () => true]];
  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const f = FILTROS.find(x => x[0] === filtro)[2];
    return (lista || []).filter(f)
      .filter(c => !etiqueta || (asignadas[c.telefono] || []).includes(etiqueta))
      .filter(c => !etapa || (etapa === "sin" ? !etapaDe(c) : etapaDe(c)?.id === etapa))
      .filter(c => !t || [c.telefono, c.nombre_perfil, c.cliente_nombre, c.ultimo_texto].join(" ").toLowerCase().includes(t));
  }, [lista, texto, filtro, etiqueta, etapa, asignadas, etiquetas]);
  const porId = Object.fromEntries(etiquetas.map(e => [e.id, e]));
  const ocultos = (lista || []).filter(c => !esConversacion(c)).length;

  return (
    <main className="pagina">
      <div className="cabecera">
        <h1 className="titulo">Mensajes</h1>
        <a className="enlace" href="#/etiquetas">Etiquetas</a>
      </div>
      <p className="ayuda">Copia de tu WhatsApp (solo lectura). Responde desde tu app de WhatsApp Business como siempre.</p>
      <input className="buscar" type="search" placeholder="Buscar por nombre, número o texto…" value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="chips">
        {FILTROS.map(([k, t, f]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
          {t}{lista && <span className="num"> {lista.filter(f).length}</span>}</button>)}
      </div>
      {etiquetas.some(e => e.es_etapa) && (
        <div className="chips" aria-label="Filtrar por etapa">
          {etiquetas.filter(e => e.es_etapa).map(e => <Etiqueta key={e.id} etiqueta={e} activa={etapa === e.id} onClick={() => setEtapa(x => x === e.id ? null : e.id)} />)}
          <button className="etiqueta-chat" aria-pressed={etapa === "sin"} style={{ opacity: etapa === "sin" ? 1 : .65 }} onClick={() => setEtapa(x => x === "sin" ? null : "sin")}>Sin etapa</button>
        </div>
      )}
      {etiquetas.some(e => !e.es_etapa) && (
        <div className="chips" aria-label="Filtrar por etiqueta">
          {etiquetas.filter(e => !e.es_etapa).map(e => <Etiqueta key={e.id} etiqueta={e} activa={etiqueta === e.id} onClick={() => setEtiqueta(x => x === e.id ? null : e.id)} />)}
        </div>
      )}
      {filtro === "conversaciones" && ocultos > 0 && (
        <p className="ayuda">{ocultos} chat(s) sin respuesta del cliente (difusiones o avisos automáticos de WhatsApp) están en "Todos".</p>
      )}
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && !visibles.length && (
        <div className="vacio"><span className="jp">無</span>
          <p>{lista.length ? "Nada con ese filtro." : "Aún no llegan mensajes."}</p></div>
      )}
      <ul className="lista">
        {visibles.map(c => (
          <li key={c.telefono} className={"item" + (nuevo(c) ? " nuevo" : "") + (etapaDe(c) ? " con-etapa" : "")}
            style={etapaDe(c) ? { "--c": COLORES_ETIQUETA[etapaDe(c).color - 1] } : undefined}>
            <a className="item-link" href={`#/mensajes/${c.telefono}`}>
              <span className="paso jp">{(c.cliente_nombre || c.nombre_perfil || "#").trim()[0]?.toUpperCase()}</span>
              <span className="item-texto">
                <b>{c.cliente_nombre || c.nombre_perfil || "+" + c.telefono}{c.cliente_nombre && <span className="etiqueta cl">Cliente</span>}</b>
                <small>{c.ultima_direccion === "saliente" && c.ultimo_tipo !== "unsupported" ? "Tú: " : ""}{resumenTipo(c.ultimo_tipo, c.ultimo_texto)}</small>
                {(asignadas[c.telefono] || []).length > 0 && (
                  <span className="etiquetas-fila">{[...asignadas[c.telefono]].sort((a, b) => (porId[b]?.es_etapa ? 1 : 0) - (porId[a]?.es_etapa ? 1 : 0)).map(id => porId[id] && <Etiqueta key={id} etiqueta={porId[id]} chica />)}</span>
                )}
                <small className="num">{hora(c.ultimo_en)} · {c.mensajes} mensaje(s)</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
