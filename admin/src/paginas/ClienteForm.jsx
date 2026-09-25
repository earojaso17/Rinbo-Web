import { useEffect, useState } from "react";
import { obtenerCliente, crearCliente, actualizarCliente, borrarCliente, listarPedidos, linkWhatsapp, mensajeError } from "../lib/datos.js";
import { ir, Cargando } from "../lib/ui.jsx";
import { FilaPedido } from "./Pedidos.jsx";

export const CLIENTE_VACIO = { nombre: "", whatsapp: "", instagram: "", email: "", ciudad: "", notas: "" };
const aForm = c => Object.fromEntries(Object.keys(CLIENTE_VACIO).map(k => [k, c[k] ?? ""]));

// Campos del cliente (se usan aquí y al crear un pedido con cliente nuevo)
export function CamposCliente({ form, setForm }) {
  const cambiar = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <>
      <label className="campo">Nombre *<input required value={form.nombre} onChange={cambiar("nombre")} autoComplete="off" /></label>
      <div className="dos">
        <label className="campo">WhatsApp<input type="tel" inputMode="tel" value={form.whatsapp} onChange={cambiar("whatsapp")} placeholder="+56 9 1234 5678" /></label>
        <label className="campo">Instagram<input value={form.instagram} onChange={cambiar("instagram")} placeholder="@usuario" autoCapitalize="none" /></label>
      </div>
      <div className="dos">
        <label className="campo">Ciudad<input value={form.ciudad} onChange={cambiar("ciudad")} /></label>
        <label className="campo">Correo<input type="email" value={form.email} onChange={cambiar("email")} autoCapitalize="none" /></label>
      </div>
      <label className="campo">Notas (solo tú las ves)<textarea rows="2" value={form.notas} onChange={cambiar("notas")} placeholder="Dirección de despacho, tallas, preferencias…" /></label>
    </>
  );
}

export default function ClienteForm({ id }) {
  const nuevo = !id;
  const [form, setForm] = useState(nuevo ? CLIENTE_VACIO : null);
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (nuevo) return;
    Promise.all([obtenerCliente(id), listarPedidos({ clienteId: id })])
      .then(([c, p]) => { if (!c) { setError("Ese cliente no existe."); return; } setForm(aForm(c)); setPedidos(p); })
      .catch(e => setError(mensajeError(e)));
  }, [id]);

  if (error && !form) return <main className="pagina"><p className="aviso error">{error}</p><a className="enlace" href="#/clientes">← Volver</a></main>;
  if (!form) return <Cargando />;

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError(""); setAviso("");
    try {
      const c = nuevo ? await crearCliente(form) : await actualizarCliente(id, form);
      if (nuevo) { ir(`/clientes/${c.id}`); return; }
      setForm(aForm(c)); setAviso("Guardado.");
    } catch (err) { setError(mensajeError(err)); }
    setGuardando(false);
  }

  async function borrar() {
    if (!confirm(`¿Borrar a ${form.nombre}?`)) return;
    try { await borrarCliente(id); ir("/clientes"); } catch (err) { setError(mensajeError(err)); }
  }

  return (
    <main className="pagina">
      <a className="enlace" href="#/clientes">← Clientes</a>
      <h1 className="titulo">{nuevo ? "Nuevo cliente" : form.nombre}</h1>
      <form onSubmit={guardar} className="tarjeta">
        <CamposCliente form={form} setForm={setForm} />
        {!nuevo && form.whatsapp && <a className="btn chico" href={linkWhatsapp(form.whatsapp, "")} target="_blank" rel="noopener">Abrir WhatsApp</a>}
        {error && <p className="aviso error" role="alert">{error}</p>}
        {aviso && <p className="aviso ok">{aviso}</p>}
        <div className="acciones">
          <button className="btn principal" disabled={guardando}>{guardando ? "Guardando…" : nuevo ? "Crear cliente" : "Guardar cambios"}</button>
          {!nuevo && <button type="button" className="btn peligro" onClick={borrar}>Borrar</button>}
        </div>
      </form>
      {!nuevo && (
        <section className="tarjeta">
          <h2 className="subtitulo">Pedidos <small className="num">{pedidos.length}</small></h2>
          <ul className="lista">{pedidos.map(p => <FilaPedido key={p.id} p={p} />)}</ul>
          <a className="btn chico" href={`#/pedidos/nuevo?cliente=${id}`}>+ Nuevo pedido para este cliente</a>
        </section>
      )}
    </main>
  );
}
