import { useEffect, useMemo, useState } from "react";
import { listarProductos, cambiarCampo, urlPublica, mensajeError } from "../lib/datos.js";

const fmt = n => "$" + Number(n || 0).toLocaleString("es-CL");
const FILTROS = [
  ["todos", "Todos", () => true],
  ["publicados", "Publicados", p => p.publicado],
  ["ocultos", "Ocultos", p => !p.publicado],
  ["vendidos", "Vendidos", p => p.stock === "Vendido"]
];

export function miniatura(p) {
  const f = p.producto_fotos?.[0];
  if (!f) return "";
  if (f.ruta_miniatura || f.ruta) return urlPublica(f.ruta_miniatura || f.ruta);
  const m = String(f.url_externa || "").match(/\/d\/([\w-]+)/) || String(f.url_externa || "").match(/[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w300` : f.url_externa || "";
}

export default function Productos() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => { listarProductos().then(setLista).catch(e => setError(mensajeError(e))); }, []);

  const visibles = useMemo(() => {
    if (!lista) return [];
    const t = texto.trim().toLowerCase();
    const f = FILTROS.find(x => x[0] === filtro)[2];
    return lista.filter(f).filter(p => !t || [p.id, p.nombre, p.categoria_principal, p.categoria_secundaria, p.detalle, p.marca].join(" ").toLowerCase().includes(t));
  }, [lista, texto, filtro]);

  async function alternarPublicado(p) {
    const nuevo = !p.publicado;
    setLista(l => l.map(x => x.id === p.id ? { ...x, publicado: nuevo } : x));
    try { await cambiarCampo(p.id, { publicado: nuevo }); }
    catch (e) { setError(mensajeError(e)); setLista(l => l.map(x => x.id === p.id ? { ...x, publicado: !nuevo } : x)); }
  }

  return (
    <main className="pagina">
      <div className="cabecera">
        <h1 className="titulo">Productos</h1>
        <a className="btn principal" href="#/productos/nuevo">+ Nuevo</a>
      </div>
      <input className="buscar" type="search" placeholder="Buscar por nombre, código, categoría…" value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="chips" role="group" aria-label="Filtrar">
        {FILTROS.map(([k, t]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
          {t}{lista && <span className="num"> {lista.filter(FILTROS.find(x => x[0] === k)[2]).length}</span>}
        </button>)}
      </div>
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && !visibles.length && (
        <div className="vacio">
          <span className="jp">無</span>
          <p>{lista.length ? "No hay productos con ese filtro." : "Aún no hay productos. Crea el primero."}</p>
        </div>
      )}
      <ul className="lista">
        {visibles.map(p => (
          <li key={p.id} className={"item" + (p.stock === "Vendido" ? " vendido" : "")}>
            <a className="item-link" href={`#/productos/${encodeURIComponent(p.id)}`}>
              <span className="foto">{miniatura(p) ? <img src={miniatura(p)} alt="" loading="lazy" /> : <span className="jp">品</span>}</span>
              <span className="item-texto">
                <b>{p.nombre}</b>
                <small className="mono">{p.id} · {p.categoria_principal || "Sin categoría"}</small>
                <span className="item-precio">
                  {p.precio_clp ? (p.precio_oferta && p.precio_oferta < p.precio_clp
                    ? <><span className="oferta num">{fmt(p.precio_oferta)}</span> <s className="num">{fmt(p.precio_clp)}</s></>
                    : <span className="num">{fmt(p.precio_clp)}</span>) : "A consultar"}
                  <span className={"etiqueta " + (p.stock === "En Chile" ? "cl" : p.stock === "Vendido" ? "vend" : "")}>{p.stock}</span>
                </span>
              </span>
            </a>
            <label className="interruptor" title={p.publicado ? "Publicado en la web" : "Oculto"}>
              <input type="checkbox" checked={p.publicado} onChange={() => alternarPublicado(p)} />
              <span>{p.publicado ? "Visible" : "Oculto"}</span>
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}
