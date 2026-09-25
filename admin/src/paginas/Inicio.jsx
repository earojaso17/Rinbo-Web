import { useEffect, useState } from "react";
import { usoAlmacenamiento, borrarArchivosHuerfanos, mensajeError } from "../lib/datos.js";

const mb = b => (b / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: b < 10 * 1024 * 1024 ? 1 : 0 }) + " MB";

function Barra({ titulo, usado, limite, porcentaje }) {
  const nivel = porcentaje >= 90 ? "alto" : porcentaje >= 70 ? "medio" : "";
  return (
    <div className="uso">
      <div className="uso-fila"><b>{titulo}</b><span className="num">{mb(usado)} de {mb(limite)}</span></div>
      <div className={"uso-barra " + nivel}><span style={{ width: Math.max(1, Math.min(100, porcentaje)) + "%" }} /></div>
      <small className="num">{porcentaje.toLocaleString("es-CL")} % usado{nivel === "alto" ? " · ¡casi lleno!" : ""}</small>
    </div>
  );
}

export default function Inicio({ correo }) {
  const [uso, setUso] = useState(null);
  const [error, setError] = useState("");
  const [limpiando, setLimpiando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = () => usoAlmacenamiento().then(setUso).catch(e => setError(mensajeError(e)));
  useEffect(() => { cargar(); }, []);

  async function limpiar() {
    if (!confirm("¿Borrar las fotos que ya no usa ningún producto? No se puede deshacer.")) return;
    setLimpiando(true);
    try { const n = await borrarArchivosHuerfanos(); setAviso(`${n} archivo(s) borrado(s).`); await cargar(); }
    catch (e) { setError(mensajeError(e)); }
    setLimpiando(false);
  }

  return (
    <main className="pagina">
      <p className="sobre">Hola, {correo}</p>
      <h1 className="titulo">Inicio</h1>
      {error && <p className="aviso error">{error}</p>}
      {!uso && !error && <div className="girando" aria-label="Cargando" />}
      {uso && (
        <>
          <section className="tarjeta resumen">
            <a href="#/productos"><b className="num">{uso.tablas.productos}</b><span>Productos</span></a>
            <span><b className="num">{uso.tablas.clientes}</b><span>Clientes</span></span>
            <span><b className="num">{uso.tablas.pedidos}</b><span>Pedidos</span></span>
          </section>
          <section className="tarjeta">
            <h2 className="subtitulo">Espacio del plan gratis</h2>
            <Barra titulo="Base de datos" usado={uso.base_datos.bytes} limite={uso.base_datos.limite} porcentaje={uso.base_datos.porcentaje} />
            <Barra titulo="Fotos y archivos" usado={uso.archivos.bytes} limite={uso.archivos.limite} porcentaje={uso.archivos.porcentaje} />
            <ul className="carpetas">
              {uso.carpetas.map(c => <li key={c.carpeta}><span>{c.carpeta === "productos" ? "Fotos de productos" : "Evidencias de pedidos"}</span><span className="num">{c.archivos} archivos · {mb(c.bytes)}</span></li>)}
            </ul>
            {uso.huerfanos.archivos > 0 && (
              <div className="aviso">
                Hay {uso.huerfanos.archivos} foto(s) que ya nadie usa ({mb(uso.huerfanos.bytes)}).
                <button className="btn chico" onClick={limpiar} disabled={limpiando}>{limpiando ? "Borrando…" : "Borrar"}</button>
              </div>
            )}
            {aviso && <p className="aviso ok">{aviso}</p>}
          </section>
          <a className="btn principal ancho" href="#/productos/nuevo">+ Nuevo producto</a>
        </>
      )}
    </main>
  );
}
