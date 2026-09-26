import { useEffect, useMemo, useState } from "react";
import { listarConversaciones, listarEtiquetas, etiquetasDeChats, estadosChats, guardarEstadosChats, estaOculto, estaSinLeer, COLORES_ETIQUETA, mensajeError } from "../lib/datos.js";
import { fechaCorta } from "../lib/ui.jsx";
import Etiqueta from "../lib/Etiqueta.jsx";

const TIPOS = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", sticker: "Sticker", document: "📄 Documento", location: "📍 Ubicación",
  contacts: "👤 Contacto", reaction: "Reacción", edit: "✏️ Mensaje editado", unsupported: "Aviso de WhatsApp" };
export const resumenTipo = (tipo, texto) => texto ? (TIPOS[tipo] && tipo !== "reaction" ? `${TIPOS[tipo]} · ${texto}` : texto) : TIPOS[tipo] || "Mensaje";
export const hora = f => {
  const d = new Date(f), hoy = new Date();
  return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : fechaCorta(d.toISOString());
};

export default function Mensajes() {
  const [lista, setLista] = useState(null);
  const [etiquetas, setEtiquetas] = useState([]);
  const [asignadas, setAsignadas] = useState({});
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("conversaciones");
  const [etiqueta, setEtiqueta] = useState(null);   // etiqueta libre elegida
  const [etapa, setEtapa] = useState(null);         // id de etapa, "sin" = sin etapa, null = todas
  const [estados, setEstados] = useState({});
  const [seleccion, setSeleccion] = useState(null);   // null = sin modo selección; Set de teléfonos
  const [aplicando, setAplicando] = useState(false);

  const cargar = () => Promise.all([listarConversaciones(), listarEtiquetas(), etiquetasDeChats(), estadosChats()])
    .then(([l, e, a, st]) => { setLista(l); setEtiquetas(e); setAsignadas(a); setEstados(st); })
    .catch(e => setError(mensajeError(e)));
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  // Aplica un cambio a varios chats (y lo muestra de inmediato)
  async function aplicar(telefonos, cambio) {
    const filas = telefonos.map(t => ({ telefono: t, ...cambio(t) }));
    setEstados(st => { const n = { ...st }; for (const f of filas) n[f.telefono] = { ...(n[f.telefono] || {}), ...f }; return n; });
    setAplicando(true); setError("");
    try { await guardarEstadosChats(filas); } catch (e) { setError(mensajeError(e)); await cargar(); }
    setAplicando(false);
  }
  const porTel = Object.fromEntries((lista || []).map(c => [c.telefono, c]));
  const ACCIONES = {
    ocultar: t => ({ oculto: true }),
    mostrar: t => ({ oculto: false }),
    leido: t => ({ leido_hasta: porTel[t]?.ultimo_en, no_leido: false }),
    noleido: t => ({ no_leido: true }),
  };

  const etapaDe = c => (asignadas[c.telefono] || []).map(id => etiquetas.find(e => e.id === id)).find(e => e?.es_etapa);
  const nuevo = c => estaSinLeer(c, estados[c.telefono]);
  const oculto = c => estaOculto(c, estados[c.telefono]);
  const FILTROS = [["conversaciones", "Conversaciones", c => !oculto(c)], ["sinleer", "Sin leer", c => !oculto(c) && nuevo(c)],
    ["ocultos", "Ocultos", oculto], ["todos", "Todos", () => true]];
  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const f = FILTROS.find(x => x[0] === filtro)[2];
    return (lista || []).filter(f)
      .filter(c => !etiqueta || (asignadas[c.telefono] || []).includes(etiqueta))
      .filter(c => !etapa || (etapa === "sin" ? !etapaDe(c) : etapaDe(c)?.id === etapa))
      .filter(c => !t || [c.telefono, c.nombre_perfil, c.cliente_nombre, c.ultimo_texto].join(" ").toLowerCase().includes(t));
  }, [lista, texto, filtro, etiqueta, etapa, asignadas, etiquetas, estados]);
  const porId = Object.fromEntries(etiquetas.map(e => [e.id, e]));
  const sel = seleccion || new Set();
  const alternarSel = t => setSeleccion(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const todosSel = visibles.length > 0 && visibles.every(c => sel.has(c.telefono));

  return (
    <main className="pagina">
      <div className="cabecera">
        <h1 className="titulo">Mensajes</h1>
        <span className="botones derecha">
          <button className="enlace" onClick={() => setSeleccion(s => s ? null : new Set())}>{seleccion ? "Listo" : "Seleccionar"}</button>
          <a className="enlace" href="#/etiquetas">Etiquetas</a>
        </span>
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
      {filtro === "conversaciones" && lista && lista.some(oculto) && (
        <p className="ayuda">Los chats ocultos (a mano, o porque el cliente nunca escribió: difusiones y avisos de WhatsApp) están en "Ocultos".</p>
      )}
      {seleccion && (
        <label className="check chico seleccionar-todos">
          <input type="checkbox" checked={todosSel} onChange={() => setSeleccion(todosSel ? new Set() : new Set(visibles.map(c => c.telefono)))} />
          Seleccionar todos los de esta vista ({visibles.length})
        </label>
      )}
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && !visibles.length && (
        <div className="vacio"><span className="jp">無</span>
          <p>{lista.length ? "Nada con ese filtro." : "Aún no llegan mensajes."}</p></div>
      )}
      <ul className="lista">
        {visibles.map(c => (
          <li key={c.telefono} className={"item" + (nuevo(c) ? " nuevo" : "") + (etapaDe(c) ? " con-etapa" : "") + (oculto(c) ? " oculto" : "") + (sel.has(c.telefono) ? " elegido" : "")}
            style={etapaDe(c) ? { "--c": COLORES_ETIQUETA[etapaDe(c).color - 1] } : undefined}>
            {seleccion && <input type="checkbox" className="marcar" checked={sel.has(c.telefono)} onChange={() => alternarSel(c.telefono)} aria-label="Seleccionar chat" />}
            <a className="item-link" href={`#/mensajes/${c.telefono}`} onClick={seleccion ? e => { e.preventDefault(); alternarSel(c.telefono); } : undefined}>
              <span className="paso jp">{(c.cliente_nombre || c.nombre_perfil || "#").trim()[0]?.toUpperCase()}</span>
              <span className="item-texto">
                <b>{c.cliente_nombre || c.nombre_perfil || "+" + c.telefono}{c.cliente_nombre && <span className="etiqueta cl">Cliente</span>}{oculto(c) && <span className="etiqueta">Oculto</span>}</b>
                <small>{c.ultima_direccion === "saliente" && c.ultimo_tipo !== "unsupported" ? "Tú: " : ""}{resumenTipo(c.ultimo_tipo, c.ultimo_texto)}</small>
                {(asignadas[c.telefono] || []).length > 0 && (
                  <span className="etiquetas-fila">{[...asignadas[c.telefono]].sort((a, b) => (porId[b]?.es_etapa ? 1 : 0) - (porId[a]?.es_etapa ? 1 : 0)).map(id => porId[id] && <Etiqueta key={id} etiqueta={porId[id]} chica />)}</span>
                )}
                <small className="num">{hora(c.ultimo_en)} · {c.mensajes} mensaje(s)</small>
              </span>
            </a>
            {!seleccion && (
              <span className="acciones-chat">
                <button onClick={() => aplicar([c.telefono], nuevo(c) ? ACCIONES.leido : ACCIONES.noleido)} title={nuevo(c) ? "Marcar como leído" : "Marcar como no leído"} aria-label={nuevo(c) ? "Marcar como leído" : "Marcar como no leído"}>{nuevo(c) ? "✓" : "●"}</button>
                <button onClick={() => aplicar([c.telefono], oculto(c) ? ACCIONES.mostrar : ACCIONES.ocultar)} title={oculto(c) ? "Mostrar" : "Ocultar"} aria-label={oculto(c) ? "Mostrar chat" : "Ocultar chat"}>{oculto(c) ? "👁" : "🙈"}</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {seleccion && (
        <div className="barra-seleccion" role="toolbar" aria-label="Acciones para los chats seleccionados">
          <b className="num">{sel.size} seleccionado(s)</b>
          <div className="botones">
            {[["ocultar", "🙈 Ocultar"], ["mostrar", "👁 Mostrar"], ["leido", "✓ Leído"], ["noleido", "● No leído"]].map(([k, t]) => (
              <button key={k} className="btn chico" disabled={!sel.size || aplicando} onClick={async () => { await aplicar([...sel], ACCIONES[k]); setSeleccion(new Set()); }}>{t}</button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
