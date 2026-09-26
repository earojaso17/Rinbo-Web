import { useEffect, useState } from "react";
import { listarEtiquetas, crearEtiqueta, actualizarEtiqueta, borrarEtiqueta, etiquetasDeChats, COLORES_ETIQUETA, mensajeError } from "../lib/datos.js";
import Etiqueta from "../lib/Etiqueta.jsx";

const NOMBRES_COLOR = ["Azul", "Naranjo", "Turquesa", "Amarillo", "Rosado", "Verde", "Morado", "Rojo"];

function SelectorColor({ valor, onChange }) {
  return (
    <div className="colores" role="radiogroup" aria-label="Color">
      {COLORES_ETIQUETA.map((c, i) => (
        <button key={c} type="button" role="radio" aria-checked={valor === i + 1} aria-label={NOMBRES_COLOR[i]} title={NOMBRES_COLOR[i]}
          className={"color" + (valor === i + 1 ? " elegido" : "")} style={{ "--c": c }} onClick={() => onChange(i + 1)} />
      ))}
    </div>
  );
}

export default function Etiquetas() {
  const [lista, setLista] = useState(null);
  const [usos, setUsos] = useState({});
  const [nueva, setNueva] = useState({ nombre: "", color: 1, es_etapa: false });
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState("");

  const cargar = async () => {
    const [l, m] = await Promise.all([listarEtiquetas(), etiquetasDeChats()]);
    const cuenta = {};
    Object.values(m).flat().forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
    setLista(l); setUsos(cuenta);
  };
  useEffect(() => { cargar().catch(e => setError(mensajeError(e))); }, []);
  const hacer = async fn => { setError(""); try { await fn(); await cargar(); } catch (e) { setError(mensajeError(e)); } };

  return (
    <main className="pagina">
      <a className="enlace" href="#/mensajes">← Mensajes</a>
      <h1 className="titulo">Etiquetas</h1>
      <p className="ayuda"><b>Etapas del CRM:</b> cada chat tiene una sola (al elegir otra, reemplaza a la anterior y queda en el historial del cliente). <b>Etiquetas libres:</b> puedes poner varias. No se sincronizan con las etiquetas de tu celular.</p>
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && [["Etapas del CRM", lista.filter(e => e.es_etapa)], ["Etiquetas libres", lista.filter(e => !e.es_etapa)]].map(([titulo, grupo]) => grupo.length > 0 && (
        <section key={titulo} className="grupo-etiquetas">
        <h2 className="subtitulo">{titulo}</h2>
        <ul className="lista">
          {grupo.map(e => (
            <li key={e.id} className="item etiqueta-fila">
              {editando?.id === e.id ? (
                <form className="subform ancho" onSubmit={ev => { ev.preventDefault(); hacer(async () => { await actualizarEtiqueta(e.id, { nombre: editando.nombre.trim(), color: editando.color, es_etapa: editando.es_etapa }); setEditando(null); }); }}>
                  <input value={editando.nombre} maxLength={30} required onChange={ev => setEditando(x => ({ ...x, nombre: ev.target.value }))} />
                  <SelectorColor valor={editando.color} onChange={color => setEditando(x => ({ ...x, color }))} />
                  <label className="check chico"><input type="checkbox" checked={editando.es_etapa} onChange={ev => setEditando(x => ({ ...x, es_etapa: ev.target.checked }))} /> Etapa del CRM</label>
                  <div className="botones">
                    <button className="btn principal chico">Guardar</button>
                    <button type="button" className="btn chico" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <Etiqueta etiqueta={e} />
                  <small className="num">{usos[e.id] || 0} chat(s)</small>
                  <span className="botones derecha">
                    <button className="enlace" onClick={() => setEditando({ id: e.id, nombre: e.nombre, color: e.color, es_etapa: e.es_etapa })}>Editar</button>
                    <button className="enlace" onClick={() => confirm(`¿Borrar la etiqueta "${e.nombre}"? Se quita de ${usos[e.id] || 0} chat(s).`) && hacer(() => borrarEtiqueta(e.id))}>Borrar</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        </section>
      ))}
      <form className="tarjeta" onSubmit={ev => { ev.preventDefault(); hacer(async () => { await crearEtiqueta(nueva.nombre, nueva.color, nueva.es_etapa); setNueva({ nombre: "", color: 1, es_etapa: false }); }); }}>
        <h2 className="subtitulo">Nueva etiqueta</h2>
        <label className="campo">Nombre<input value={nueva.nombre} maxLength={30} required onChange={ev => setNueva(x => ({ ...x, nombre: ev.target.value }))} placeholder="Ej. Encargo pendiente" /></label>
        <div className="campo">Color<SelectorColor valor={nueva.color} onChange={color => setNueva(x => ({ ...x, color }))} /></div>
        <label className="check"><input type="checkbox" checked={nueva.es_etapa} onChange={ev => setNueva(x => ({ ...x, es_etapa: ev.target.checked }))} /> Es una etapa del CRM (un chat tiene una sola etapa)</label>
        <button className="btn principal chico">Crear etiqueta</button>
      </form>
    </main>
  );
}
