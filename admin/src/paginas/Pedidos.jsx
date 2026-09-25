import { useEffect, useMemo, useState } from "react";
import { listarPedidos, ETAPAS, mensajeError } from "../lib/datos.js";
import { fmt, fechaCorta } from "../lib/ui.jsx";

const FILTROS = [
  ["activos", "En curso", p => p.etapa !== "Entregado"],
  ["saldo", "Con saldo", p => p.saldo_clp > 0],
  ["entregados", "Entregados", p => p.etapa === "Entregado"],
  ["todos", "Todos", () => true]
];

export function FilaPedido({ p }) {
  const n = ETAPAS.indexOf(p.etapa) + 1;
  return (
    <li className="item">
      <a className="item-link" href={`#/pedidos/${p.id}`}>
        <span className={"paso num" + (n === ETAPAS.length ? " fin" : "")}>{n}<small>/{ETAPAS.length}</small></span>
        <span className="item-texto">
          <b>{p.codigo}{p.cliente_nombre ? " · " + p.cliente_nombre : ""}</b>
          <small>{p.etapa} · {fechaCorta(p.actualizado_en)}</small>
          <span className="item-precio num">
            {fmt(p.total_clp)}
            {p.saldo_clp > 0 ? <span className="etiqueta saldo">Debe {fmt(p.saldo_clp)}</span> : p.total_clp > 0 && <span className="etiqueta cl">Pagado</span>}
          </span>
        </span>
      </a>
    </li>
  );
}

export default function Pedidos() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("activos");

  useEffect(() => { listarPedidos().then(setLista).catch(e => setError(mensajeError(e))); }, []);

  const visibles = useMemo(() => {
    if (!lista) return [];
    const t = texto.trim().toLowerCase();
    const f = FILTROS.find(x => x[0] === filtro)[2];
    return lista.filter(f).filter(p => !t || [p.codigo, p.codigo_seguimiento, p.cliente_nombre, p.cliente_whatsapp, p.etapa].join(" ").toLowerCase().includes(t));
  }, [lista, texto, filtro]);

  return (
    <main className="pagina">
      <div className="cabecera">
        <h1 className="titulo">Pedidos</h1>
        <a className="btn principal" href="#/pedidos/nuevo">+ Nuevo</a>
      </div>
      <input className="buscar" type="search" placeholder="Buscar por código, cliente, etapa…" value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="chips" role="group" aria-label="Filtrar">
        {FILTROS.map(([k, t, f]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
          {t}{lista && <span className="num"> {lista.filter(f).length}</span>}
        </button>)}
      </div>
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && !visibles.length && (
        <div className="vacio">
          <span className="jp">無</span>
          <p>{lista.length ? "No hay pedidos con ese filtro." : "Aún no hay pedidos. Crea el primero, o tráelos desde SegPublica en Inicio."}</p>
        </div>
      )}
      <ul className="lista">{visibles.map(p => <FilaPedido key={p.id} p={p} />)}</ul>
      <a className="enlace" href="#/clientes">Ver clientes →</a>
    </main>
  );
}
