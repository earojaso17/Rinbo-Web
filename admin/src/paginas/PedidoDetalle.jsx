import { useEffect, useRef, useState } from "react";
import {
  obtenerPedido, actualizarPedido, borrarPedido, cambiarCodigoSeguimiento, listarClientes, listarProductos,
  agregarItem, borrarItem, agregarEtapa, cambiarEtapa, borrarEtapa, agregarPago, borrarPago,
  subirEvidencia, cambiarEvidencia, borrarEvidencia, urlsEvidencias,
  linkSeguimiento, mensajeSeguimiento, linkWhatsapp, ETAPAS, aPesos, mensajeError
} from "../lib/datos.js";
import { ir, Cargando, fmt, hoy, fechaCorta } from "../lib/ui.jsx";

const MEDIOS = ["Transferencia", "Efectivo", "Tarjeta", "Mercado Pago", "Otro"];

export default function PedidoDetalle({ id }) {
  const [p, setP] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [urls, setUrls] = useState({});
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");

  const cargar = async () => {
    const x = await obtenerPedido(id);
    if (!x) { setError("Ese pedido no existe."); return; }
    setP(x);
    urlsEvidencias(x.evidencias).then(setUrls).catch(() => {});
  };
  useEffect(() => {
    cargar().catch(e => setError(mensajeError(e)));
    listarClientes().then(setClientes).catch(() => {});
    listarProductos().then(setProductos).catch(() => {});
  }, [id]);

  if (error && !p) return <main className="pagina"><p className="aviso error">{error}</p><a className="enlace" href="#/pedidos">← Volver</a></main>;
  if (!p) return <Cargando />;

  // Ejecuta un cambio y recarga el pedido
  const hacer = async (fn, listo = "") => {
    setError(""); setAviso("");
    try { await fn(); await cargar(); if (listo) { setAviso(listo); setTimeout(() => setAviso(a => a === listo ? "" : a), 2500); } }
    catch (e) { setError(mensajeError(e)); }
  };

  const n = ETAPAS.indexOf(p.etapa);
  const saldo = p.total_clp - p.abonado_clp;
  const sumaItems = p.pedido_items.reduce((s, i) => s + i.cantidad * i.precio_unitario_clp, 0);

  return (
    <main className="pagina">
      <a className="enlace" href="#/pedidos">← Pedidos</a>
      <div className="cabecera">
        <div>
          <h1 className="titulo">{p.codigo}</h1>
          <p className="sobre">{p.clientes ? <a href={`#/clientes/${p.clientes.id}`}>{p.clientes.nombre}</a> : "Sin cliente"} · creado {fechaCorta(p.creado_en)}</p>
        </div>
        <span className={"paso grande num" + (n === ETAPAS.length - 1 ? " fin" : "")}>{n + 1}<small>/{ETAPAS.length}</small></span>
      </div>
      <p className="etapa-actual">{p.etapa}</p>

      {error && <p className="aviso error" role="alert">{error}</p>}
      {aviso && <p className="aviso ok flotante" role="status">{aviso}</p>}

      <Seguimiento p={p} hacer={hacer} />
      <Etapas p={p} hacer={hacer} />
      <Cuenta p={p} saldo={saldo} sumaItems={sumaItems} hacer={hacer} />
      <Evidencias p={p} urls={urls} hacer={hacer} ocupado={ocupado} setOcupado={setOcupado} setError={setError} cargar={cargar} />
      <Articulos p={p} productos={productos} sumaItems={sumaItems} hacer={hacer} />
      <Datos p={p} clientes={clientes} hacer={hacer} />

      <button className="btn peligro" onClick={async () => {
        if (!confirm(`¿Borrar el pedido ${p.codigo} con todo su historial, pagos y fotos? No se puede deshacer.`)) return;
        try { await borrarPedido(p); ir("/pedidos"); } catch (e) { setError(mensajeError(e)); }
      }}>Borrar pedido</button>
    </main>
  );
}

// ---------- Link para el cliente ----------
function Seguimiento({ p, hacer }) {
  const [copiado, setCopiado] = useState(false);
  const link = linkSeguimiento(p.codigo_seguimiento);
  const mensaje = mensajeSeguimiento(p);
  async function copiar() {
    try { await navigator.clipboard.writeText(mensaje); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { prompt("Copia el mensaje:", mensaje); }
  }
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Seguimiento del cliente</h2>
      <div className="codigo-secreto"><small>Código secreto</small><b className="num">{p.codigo_seguimiento}</b></div>
      <p className="ayuda">El cliente ve su pedido en <a href={link} target="_blank" rel="noopener">rinbo.store/seguimiento</a> con este código. Solo ve lo marcado como visible (no ve notas internas ni tus datos del cliente).</p>
      <div className="botones">
        <a className="btn principal chico" href={linkWhatsapp(p.clientes?.whatsapp, mensaje)} target="_blank" rel="noopener">Enviar por WhatsApp</a>
        <button className="btn chico" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar mensaje"}</button>
        <a className="btn chico" href={link} target="_blank" rel="noopener">Ver como cliente</a>
      </div>
      {!p.clientes?.whatsapp && <p className="ayuda">Sin WhatsApp del cliente: al enviar, WhatsApp te pedirá elegir el chat.</p>}
      <details>
        <summary className="ayuda">¿El link llegó a quien no debía?</summary>
        <p className="ayuda">Crea un código nuevo: el link anterior deja de funcionar y tendrás que enviarle el nuevo al cliente.</p>
        <button className="btn peligro chico" onClick={() => confirm("¿Crear un código nuevo? El link anterior deja de funcionar.") && hacer(() => cambiarCodigoSeguimiento(p.id), "Código nuevo creado. Envíaselo al cliente.")}>Cambiar código secreto</button>
      </details>
    </section>
  );
}

// ---------- Etapas ----------
function Etapas({ p, hacer }) {
  const siguiente = ETAPAS[Math.min(ETAPAS.indexOf(p.etapa) + 1, ETAPAS.length - 1)];
  const [nueva, setNueva] = useState({ etapa: siguiente, fecha: hoy(), comentario: "", visible_cliente: true });
  useEffect(() => { setNueva(x => ({ ...x, etapa: siguiente })); }, [siguiente]);
  const cambiar = k => e => setNueva(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const registradas = new Set(p.pedido_etapas.map(e => e.etapa));

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Etapas <small>{p.pedido_etapas.length} registro(s)</small></h2>
      <ol className="linea">
        {ETAPAS.map((nombre, i) => {
          const regs = p.pedido_etapas.filter(e => e.etapa === nombre);
          return (
            <li key={nombre} className={registradas.has(nombre) ? "hecha" : i < ETAPAS.indexOf(p.etapa) ? "saltada" : ""}>
              <span className="punto" />
              <div>
                <b>{nombre}</b>
                {regs.map(e => (
                  <div key={e.id} className="registro">
                    <span className="num">{fechaCorta(e.fecha)}</span>
                    {e.comentario && <span className="nota">{e.comentario}</span>}
                    <div className="registro-botones">
                      <label className="check chico"><input type="checkbox" checked={e.visible_cliente} onChange={() => hacer(() => cambiarEtapa(e.id, { visible_cliente: !e.visible_cliente }))} /> Visible</label>
                      <button className="enlace" onClick={() => confirm(`¿Quitar "${nombre}" del historial?`) && hacer(() => borrarEtapa(e.id))}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <form className="subform" onSubmit={e => { e.preventDefault(); hacer(async () => { await agregarEtapa(p.id, nueva); setNueva(x => ({ ...x, comentario: "" })); }, "Etapa registrada."); }}>
        <b>Avanzar / registrar etapa</b>
        <label className="campo">Etapa<select value={nueva.etapa} onChange={cambiar("etapa")}>{ETAPAS.map(e => <option key={e}>{e}</option>)}</select></label>
        <label className="campo corto">Fecha<input type="date" value={nueva.fecha} onChange={cambiar("fecha")} required /></label>
        <label className="campo">Comentario<textarea rows="2" value={nueva.comentario} onChange={cambiar("comentario")} placeholder="Ej. Número de seguimiento del courier" /></label>
        <label className="check"><input type="checkbox" checked={nueva.visible_cliente} onChange={cambiar("visible_cliente")} /> El cliente ve esta etapa y su comentario</label>
        <button className="btn principal chico">Registrar etapa</button>
      </form>
    </section>
  );
}

// ---------- Cuenta y pagos ----------
function Cuenta({ p, saldo, sumaItems, hacer }) {
  const [pago, setPago] = useState({ monto_clp: "", fecha: hoy(), medio: "Transferencia", nota: "" });
  const cambiar = k => e => setPago(x => ({ ...x, [k]: e.target.value }));
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Cuenta</h2>
      <dl className="cuenta num">
        <div><dt>Valor del pedido</dt><dd>{fmt(p.total_clp)}</dd></div>
        <div><dt>Abonado</dt><dd>{fmt(p.abonado_clp)}</dd></div>
        <div className={saldo > 0 ? "debe" : "ok"}><dt>{saldo > 0 ? "Saldo por pagar" : saldo < 0 ? "Pagado de más" : "Saldo"}</dt><dd>{fmt(Math.abs(saldo))}</dd></div>
      </dl>
      {sumaItems > 0 && sumaItems !== p.total_clp && (
        <p className="aviso">Los artículos suman {fmt(sumaItems)}.
          <button className="btn chico" onClick={() => hacer(() => actualizarPedido(p.id, { ...p, total_clp: sumaItems }), "Total actualizado.")}>Usar como total</button></p>
      )}
      {p.pagos.length > 0 && (
        <ul className="filas">
          {p.pagos.map(x => (
            <li key={x.id}>
              <span className="num">{fechaCorta(x.fecha)}</span>
              <span>{[x.medio, x.nota].filter(Boolean).join(" · ") || "Pago"}</span>
              <b className={"num" + (x.monto_clp < 0 ? " neg" : "")}>{fmt(x.monto_clp)}</b>
              <button className="quitar" aria-label="Borrar pago" onClick={() => confirm(`¿Borrar el pago de ${fmt(x.monto_clp)}?`) && hacer(() => borrarPago(x.id))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <form className="subform" onSubmit={e => { e.preventDefault(); if (!aPesos(pago.monto_clp)) return; hacer(async () => { await agregarPago(p.id, pago); setPago(x => ({ ...x, monto_clp: "", nota: "" })); }, "Pago registrado."); }}>
        <b>Registrar pago</b>
        <div className="dos">
          <label className="campo">Monto (CLP)<input inputMode="numeric" value={pago.monto_clp} onChange={cambiar("monto_clp")} required placeholder="Negativo = devolución" /></label>
          <label className="campo">Fecha<input type="date" value={pago.fecha} onChange={cambiar("fecha")} required /></label>
        </div>
        <div className="dos">
          <label className="campo">Medio<select value={pago.medio} onChange={cambiar("medio")}>{MEDIOS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="campo">Nota<input value={pago.nota} onChange={cambiar("nota")} placeholder="Opcional" /></label>
        </div>
        <button className="btn principal chico">Registrar pago</button>
      </form>
    </section>
  );
}

// ---------- Fotos de evidencia ----------
function Evidencias({ p, urls, hacer, ocupado, setOcupado, setError, cargar }) {
  const entrada = useRef(null);
  const [visible, setVisible] = useState(true);
  async function subir(e) {
    const archivos = [...e.target.files];
    e.target.value = "";
    for (const [i, a] of archivos.entries()) {
      setOcupado(`Comprimiendo y subiendo foto ${i + 1} de ${archivos.length}…`);
      try { await subirEvidencia(p.id, a, { visible_cliente: visible }); }
      catch (err) { setError(`Foto "${a.name}": ${mensajeError(err)}`); }
    }
    setOcupado("");
    await cargar();
  }
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Fotos del pedido <small>{p.evidencias.length}</small></h2>
      {p.evidencias.length > 0 && (
        <ul className="fotos">
          {p.evidencias.map(ev => (
            <li key={ev.id} className={ev.visible_cliente ? "" : "oculta"}>
              {urls[ev.id] ? <a href={urls[ev.id]} target="_blank" rel="noopener"><img src={urls[ev.id]} alt="Evidencia" loading="lazy" /></a> : <span className="jp">写</span>}
              {!ev.visible_cliente && <span className="portada gris">Oculta</span>}
              <div className="fotos-botones">
                <button type="button" onClick={() => hacer(() => cambiarEvidencia(ev.id, { visible_cliente: !ev.visible_cliente }))} aria-label={ev.visible_cliente ? "Ocultar al cliente" : "Mostrar al cliente"} title={ev.visible_cliente ? "Ocultar al cliente" : "Mostrar al cliente"}>{ev.visible_cliente ? "👁" : "🚫"}</button>
                <button type="button" onClick={() => confirm("¿Borrar esta foto?") && hacer(() => borrarEvidencia(ev))} aria-label="Borrar foto">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={subir} />
      <label className="check"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Las fotos nuevas las ve el cliente</label>
      <button className="btn chico" onClick={() => entrada.current.click()} disabled={!!ocupado}>+ Agregar fotos</button>
      {ocupado && <p className="aviso">{ocupado}</p>}
      <p className="ayuda">Compra, empaque, envío… Son privadas: el cliente las ve solo con su código secreto. 👁 = visible para el cliente.</p>
    </section>
  );
}

// ---------- Artículos ----------
function Articulos({ p, productos, sumaItems, hacer }) {
  const [it, setIt] = useState({ producto_id: "", descripcion: "", cantidad: 1, precio_unitario_clp: "" });
  function elegirProducto(e) {
    const prod = productos.find(x => x.id === e.target.value);
    setIt(x => ({ ...x, producto_id: e.target.value, descripcion: prod ? prod.nombre : x.descripcion,
      precio_unitario_clp: prod ? String(prod.precio_oferta || prod.precio_clp || "") : x.precio_unitario_clp }));
  }
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Artículos <small className="num">{fmt(sumaItems)}</small></h2>
      {p.pedido_items.length > 0 && (
        <ul className="filas">
          {p.pedido_items.map(x => (
            <li key={x.id}>
              <span className="num">{x.cantidad}×</span>
              <span>{x.descripcion}{x.producto_id && <small className="mono"> {x.producto_id}</small>}</span>
              <b className="num">{fmt(x.cantidad * x.precio_unitario_clp)}</b>
              <button className="quitar" aria-label="Quitar artículo" onClick={() => confirm(`¿Quitar "${x.descripcion}"?`) && hacer(() => borrarItem(x.id))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <form className="subform" onSubmit={e => { e.preventDefault(); hacer(async () => { await agregarItem(p.id, it); setIt({ producto_id: "", descripcion: "", cantidad: 1, precio_unitario_clp: "" }); }); }}>
        <b>Agregar artículo</b>
        <label className="campo">Producto del catálogo (opcional)
          <select value={it.producto_id} onChange={elegirProducto}>
            <option value="">— Otro / encargo —</option>
            {productos.map(x => <option key={x.id} value={x.id}>{x.nombre} ({x.id})</option>)}
          </select>
        </label>
        <label className="campo">Descripción<input required value={it.descripcion} onChange={e => setIt(x => ({ ...x, descripcion: e.target.value }))} placeholder="Ej. Polera talla M, color negro" /></label>
        <div className="dos">
          <label className="campo">Cantidad<input type="number" min="1" value={it.cantidad} onChange={e => setIt(x => ({ ...x, cantidad: e.target.value }))} /></label>
          <label className="campo">Precio unitario<input inputMode="numeric" value={it.precio_unitario_clp} onChange={e => setIt(x => ({ ...x, precio_unitario_clp: e.target.value }))} placeholder="CLP" /></label>
        </div>
        <button className="btn chico">Agregar</button>
      </form>
    </section>
  );
}

// ---------- Datos generales ----------
function Datos({ p, clientes, hacer }) {
  const [f, setF] = useState({ cliente_id: p.cliente_id || "", total_clp: String(p.total_clp), comentarios_generales: p.comentarios_generales || "", notas_internas: p.notas_internas || "" });
  useEffect(() => { setF({ cliente_id: p.cliente_id || "", total_clp: String(p.total_clp), comentarios_generales: p.comentarios_generales || "", notas_internas: p.notas_internas || "" }); }, [p]);
  const cambiar = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  return (
    <form className="tarjeta" onSubmit={e => { e.preventDefault(); hacer(() => actualizarPedido(p.id, f), "Guardado."); }}>
      <h2 className="subtitulo">Datos del pedido</h2>
      <label className="campo">Cliente
        <select value={f.cliente_id} onChange={cambiar("cliente_id")}>
          <option value="">— Sin cliente —</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <small><a href="#/clientes/nuevo">+ Crear cliente</a> (luego vuelve y elígelo)</small>
      </label>
      <label className="campo">Valor total (CLP)<input inputMode="numeric" value={f.total_clp} onChange={cambiar("total_clp")} /></label>
      <label className="campo">Información para el cliente<textarea rows="3" value={f.comentarios_generales} onChange={cambiar("comentarios_generales")} />
        <small>Se ve en el seguimiento.</small></label>
      <label className="campo">Notas internas<textarea rows="3" value={f.notas_internas} onChange={cambiar("notas_internas")} />
        <small>Solo tú las ves.</small></label>
      <button className="btn principal">Guardar datos</button>
    </form>
  );
}
