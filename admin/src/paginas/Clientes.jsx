import { useEffect, useMemo, useState } from "react";
import { listarClientes, mensajeError } from "../lib/datos.js";

export default function Clientes() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");

  useEffect(() => { listarClientes().then(setLista).catch(e => setError(mensajeError(e))); }, []);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (lista || []).filter(c => !t || [c.nombre, c.whatsapp, c.instagram, c.email, c.ciudad].join(" ").toLowerCase().includes(t));
  }, [lista, texto]);

  return (
    <main className="pagina">
      <div className="cabecera">
        <h1 className="titulo">Clientes</h1>
        <a className="btn principal" href="#/clientes/nuevo">+ Nuevo</a>
      </div>
      <input className="buscar" type="search" placeholder="Buscar por nombre, WhatsApp, Instagram…" value={texto} onChange={e => setTexto(e.target.value)} />
      {error && <p className="aviso error">{error}</p>}
      {!lista && !error && <div className="girando" aria-label="Cargando" />}
      {lista && !visibles.length && (
        <div className="vacio"><span className="jp">無</span><p>{lista.length ? "Nadie coincide con la búsqueda." : "Aún no hay clientes."}</p></div>
      )}
      <ul className="lista">
        {visibles.map(c => (
          <li key={c.id} className="item">
            <a className="item-link" href={`#/clientes/${c.id}`}>
              <span className="paso jp">{c.nombre.trim()[0]?.toUpperCase()}</span>
              <span className="item-texto">
                <b>{c.nombre}</b>
                <small>{[c.whatsapp && "+" + c.whatsapp, c.instagram, c.ciudad].filter(Boolean).join(" · ") || "Sin contacto"}</small>
                <small className="num">{c.pedidos?.[0]?.count || 0} pedido(s)</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <a className="enlace" href="#/pedidos">← Pedidos</a>
    </main>
  );
}
