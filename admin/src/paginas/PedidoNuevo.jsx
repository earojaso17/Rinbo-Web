import { useEffect, useState } from "react";
import { listarClientes, crearCliente, crearPedido, mensajeError } from "../lib/datos.js";
import { ir, Cargando } from "../lib/ui.jsx";
import { CamposCliente, CLIENTE_VACIO } from "./ClienteForm.jsx";

// Pedido nuevo: cliente (uno existente o uno nuevo) + total. Lo demás (artículos, etapas, pagos, fotos) en la ficha.
export default function PedidoNuevo({ clienteInicial }) {
  const [clientes, setClientes] = useState(null);
  const [clienteId, setClienteId] = useState(clienteInicial || "");
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [total, setTotal] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { listarClientes().then(setClientes).catch(e => setError(mensajeError(e))); }, []);
  if (!clientes && !error) return <Cargando />;

  async function crear(e) {
    e.preventDefault();
    setGuardando(true); setError("");
    try {
      let cid = clienteId === "nuevo" ? (await crearCliente(cliente)).id : clienteId || null;
      const id = await crearPedido({ cliente_id: cid, total_clp: total, comentarios_generales: comentarios });
      ir(`/pedidos/${id}`);
    } catch (err) { setError(mensajeError(err)); setGuardando(false); }
  }

  return (
    <main className="pagina">
      <a className="enlace" href="#/pedidos">← Pedidos</a>
      <h1 className="titulo">Nuevo pedido</h1>
      <form onSubmit={crear}>
        <section className="tarjeta">
          <h2 className="subtitulo">Cliente</h2>
          <label className="campo">Cliente
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
              <option value="">— Sin cliente por ahora —</option>
              <option value="nuevo">+ Cliente nuevo…</option>
              {(clientes || []).map(c => <option key={c.id} value={c.id}>{c.nombre}{c.whatsapp ? ` (+${c.whatsapp})` : ""}</option>)}
            </select>
          </label>
          {clienteId === "nuevo" && <CamposCliente form={cliente} setForm={setCliente} />}
        </section>
        <section className="tarjeta" style={{ marginTop: 14 }}>
          <h2 className="subtitulo">Pedido</h2>
          <label className="campo">Valor total (CLP)<input inputMode="numeric" value={total} onChange={e => setTotal(e.target.value)} placeholder="Puedes completarlo después" /></label>
          <label className="campo">Información para el cliente<textarea rows="3" value={comentarios} onChange={e => setComentarios(e.target.value)} />
            <small>Se ve en el seguimiento (ej. fecha estimada de llegada).</small></label>
          <p className="ayuda">El código (R00001…) y el código secreto de seguimiento se crean solos. El pedido parte en "Encargo Confirmado" con fecha de hoy.</p>
        </section>
        {error && <p className="aviso error" role="alert">{error}</p>}
        <div className="acciones">
          <button className="btn principal" disabled={guardando}>{guardando ? "Creando…" : "Crear pedido"}</button>
        </div>
      </form>
    </main>
  );
}
