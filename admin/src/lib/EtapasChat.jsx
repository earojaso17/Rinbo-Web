import { useEffect, useState } from "react";
import { listarEtiquetas, etiquetasDeChats, ponerEtiqueta, quitarEtiqueta, historialEtapas, mensajeError } from "./datos.js";
import Etiqueta from "./Etiqueta.jsx";
import { fechaCorta } from "./ui.jsx";

// Etapa del CRM (una a la vez) + etiquetas libres de un número de WhatsApp. Se usa en el chat y en la ficha del cliente.
export default function EtapasChat({ telefono, conHistorial = false, alCambiar }) {
  const [etiquetas, setEtiquetas] = useState([]);
  const [mias, setMias] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState("");

  const cargarHistorial = () => conHistorial && historialEtapas(telefono).then(setHistorial).catch(() => {});
  useEffect(() => {
    if (!telefono) return;
    Promise.all([listarEtiquetas(), etiquetasDeChats()]).then(([e, a]) => { setEtiquetas(e); setMias(a[telefono] || []); }).catch(e => setError(mensajeError(e)));
    cargarHistorial();
  }, [telefono]);

  if (!telefono) return null;
  const etapas = etiquetas.filter(e => e.es_etapa), libres = etiquetas.filter(e => !e.es_etapa);

  async function alternar(e) {
    const tiene = mias.includes(e.id);
    const antes = mias;
    // En la pantalla: una etapa reemplaza a la anterior (la base hace lo mismo)
    setMias(m => tiene ? m.filter(x => x !== e.id) : [...m.filter(x => !(e.es_etapa && etapas.some(t => t.id === x))), e.id]);
    setError("");
    try {
      tiene ? await quitarEtiqueta(telefono, e.id) : await ponerEtiqueta(telefono, e.id);
      cargarHistorial(); alCambiar?.();
    } catch (err) { setError(mensajeError(err)); setMias(antes); }
  }

  return (
    <div className="crm">
      {etapas.length > 0 && (
        <div className="crm-fila">
          <span className="crm-rotulo">Etapa</span>
          <div className="chips">{etapas.map(e => <Etiqueta key={e.id} etiqueta={e} activa={mias.includes(e.id)} onClick={() => alternar(e)} />)}</div>
        </div>
      )}
      {libres.length > 0 && (
        <div className="crm-fila">
          <span className="crm-rotulo">Etiquetas</span>
          <div className="chips">
            {libres.map(e => <Etiqueta key={e.id} etiqueta={e} activa={mias.includes(e.id)} onClick={() => alternar(e)} />)}
            <a className="enlace" href="#/etiquetas">Editar</a>
          </div>
        </div>
      )}
      {error && <p className="aviso error">{error}</p>}
      {conHistorial && historial.length > 0 && (
        <details className="crm-historial">
          <summary className="ayuda">Historial de etapas ({historial.length})</summary>
          <ol>{historial.map(h => <li key={h.id}><span className="num">{fechaCorta(h.cambiado_en)}</span> {h.etapa}</li>)}</ol>
        </details>
      )}
    </div>
  );
}
