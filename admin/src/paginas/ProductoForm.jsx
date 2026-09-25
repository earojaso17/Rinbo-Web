import { useEffect, useRef, useState } from "react";
import { obtenerProducto, listarProductos, crearProducto, actualizarProducto, borrarProducto,
  subirFoto, borrarFoto, ordenar, urlPublica, urlEnLaWeb, mensajeError } from "../lib/datos.js";
import { ir, Cargando } from "../lib/ui.jsx";
import Publicar from "../lib/Publicar.jsx";

const VACIO = { id: "", nombre: "", categoria_principal: "", categoria_secundaria: "", detalle: "", marca: "",
  opcion_1: "", opcion_2: "", descripcion: "", estado: "Nuevo", precio_clp: "", precio_oferta: "", stock: "En Japón",
  publicado: false, destacado: false, tabla_tallas: "", detalle_pie: "", instagram: "", orden: 0 };
const STOCK = ["En Japón", "En Chile", "Por encargo", "Vendido"];
const ESTADOS = ["Nuevo", "Usado", "Usado — S", "Usado — A", "Usado — B", "Usado — C", "Semi nuevo"];
const MAX_FOTOS = 12;

const aForm = p => Object.fromEntries(Object.keys(VACIO).map(k => [k, p[k] ?? VACIO[k]]));
const unicos = (lista, campo) => [...new Set(lista.map(p => p[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

// Sugerencia de código: mismo prefijo que el último producto + número siguiente (ej. ROP-02607015 → ROP-02607016)
function sugerirId(lista) {
  const ids = lista.map(p => p.id).filter(id => /\d+$/.test(id)).sort();
  const ultimo = ids[ids.length - 1];
  if (!ultimo) return "";
  const [, pre, num] = ultimo.match(/^(.*?)(\d+)$/);
  return pre + String(parseInt(num, 10) + 1).padStart(num.length, "0");
}

export default function ProductoForm({ id }) {
  const nuevo = !id;
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null); // producto tal como está guardado (incluye fotos)
  const [todos, setTodos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState("");
  const entrada = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const lista = await listarProductos();
        setTodos(lista);
        if (nuevo) { setForm({ ...VACIO, id: sugerirId(lista) }); return; }
        const p = await obtenerProducto(id);
        if (!p) { setError("Ese producto no existe."); return; }
        setOriginal(p); setForm(aForm(p));
      } catch (e) { setError(mensajeError(e)); }
    })();
  }, [id]);

  if (error && !form) return <main className="pagina"><p className="aviso error">{error}</p><a className="enlace" href="#/productos">← Volver</a></main>;
  if (!form) return <Cargando />;

  const cambiar = campo => e => setForm(f => ({ ...f, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const fotos = original?.producto_fotos || [];

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError(""); setAviso("");
    try {
      const p = nuevo ? await crearProducto(form) : await actualizarProducto(original.id, form);
      setOriginal(p); setForm(aForm(p));
      if (nuevo || p.id !== id) { ir(`/productos/${encodeURIComponent(p.id)}`); return; }
      setAviso("Guardado.");
    } catch (err) { setError(mensajeError(err)); }
    setGuardando(false);
  }

  async function borrar() {
    if (!confirm(`¿Borrar "${original.nombre}" y sus fotos? No se puede deshacer.`)) return;
    try { await borrarProducto(original); ir("/productos"); }
    catch (err) { setError(mensajeError(err)); }
  }

  async function agregarFotos(e) {
    const archivos = [...e.target.files].slice(0, MAX_FOTOS - fotos.length);
    e.target.value = "";
    if (!archivos.length) return;
    setError(""); setAviso("");
    let posicion = fotos.length;
    for (const [i, archivo] of archivos.entries()) {
      setSubiendo(`Comprimiendo y subiendo foto ${i + 1} de ${archivos.length}…`);
      try { await subirFoto(original.id, archivo, ++posicion); }
      catch (err) { setError(`Foto "${archivo.name}": ${mensajeError(err)}`); posicion--; }
    }
    setOriginal(await obtenerProducto(original.id));
    setSubiendo("");
  }

  async function mover(i, paso) {
    const orden = [...fotos];
    const j = i + paso;
    if (j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    setOriginal(o => ({ ...o, producto_fotos: orden.map((f, k) => ({ ...f, posicion: k + 1 })) }));
    try { await ordenar(original.id, orden.map(f => f.id)); }
    catch (err) { setError(mensajeError(err)); setOriginal(await obtenerProducto(original.id)); }
  }

  async function quitarFoto(f) {
    if (!confirm("¿Borrar esta foto?")) return;
    try {
      await borrarFoto(original.id, f, fotos.filter(x => x.id !== f.id));
      setOriginal(await obtenerProducto(original.id));
    } catch (err) { setError(mensajeError(err)); }
  }

  const fotoSrc = f => f.ruta_miniatura || f.ruta ? urlPublica(f.ruta_miniatura || f.ruta) : f.url_externa;

  return (
    <main className="pagina">
      <a className="enlace" href="#/productos">← Productos</a>
      <h1 className="titulo">{nuevo ? "Nuevo producto" : form.nombre || "Producto"}</h1>
      {!nuevo && original?.publicado && (
        <a className="enlace" href={urlEnLaWeb(original.nombre)} target="_blank" rel="noopener">Ver en rinbo.store ↗ <small>(se actualiza sola cada 15 min, o con "Publicar cambios ahora")</small></a>
      )}

      <section className="tarjeta">
        <h2 className="subtitulo">Fotos <small className="num">{fotos.length} / {MAX_FOTOS}</small></h2>
        {nuevo ? <p className="ayuda">Guarda el producto para poder agregar fotos.</p> : (
          <>
            <ul className="fotos">
              {fotos.map((f, i) => (
                <li key={f.id}>
                  <img src={fotoSrc(f)} alt={`Foto ${i + 1}`} />
                  {i === 0 && <span className="portada">Portada</span>}
                  <div className="fotos-botones">
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover antes">←</button>
                    <button type="button" onClick={() => quitarFoto(f)} aria-label="Borrar foto">✕</button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} aria-label="Mover después">→</button>
                  </div>
                </li>
              ))}
              {fotos.length < MAX_FOTOS && (
                <li className="agregar">
                  <button type="button" onClick={() => entrada.current.click()} disabled={!!subiendo}>+<span>Agregar fotos</span></button>
                </li>
              )}
            </ul>
            <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={agregarFotos} />
            {subiendo && <p className="aviso">{subiendo}</p>}
            <p className="ayuda">La primera foto es la portada. Se comprimen solas antes de subir (máx. 1200 px).</p>
          </>
        )}
      </section>

      <form onSubmit={guardar}>
        <section className="tarjeta">
          <h2 className="subtitulo">Datos</h2>
          <label className="campo">Nombre *<input required value={form.nombre} onChange={cambiar("nombre")} /></label>
          <label className="campo">Código *<input required value={form.id} onChange={cambiar("id")} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" title="Letras, números, guion y guion bajo" autoCapitalize="characters" />
            <small>Es el código del producto (aparece en el mensaje de WhatsApp).</small></label>
          <div className="dos">
            <label className="campo">Categoría<input list="l-cat" value={form.categoria_principal} onChange={cambiar("categoria_principal")} /></label>
            <label className="campo">Subcategoría<input list="l-sub" value={form.categoria_secundaria} onChange={cambiar("categoria_secundaria")} /></label>
          </div>
          <datalist id="l-cat">{unicos(todos, "categoria_principal").map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="l-sub">{unicos(todos.filter(p => !form.categoria_principal || p.categoria_principal === form.categoria_principal), "categoria_secundaria").map(v => <option key={v} value={v} />)}</datalist>
          <label className="campo">Detalle (línea corta bajo el nombre)<input value={form.detalle} onChange={cambiar("detalle")} /></label>
          <label className="campo">Marca<input list="l-marca" value={form.marca} onChange={cambiar("marca")} /><small>Opcional; ayuda en Google Shopping.</small></label>
          <datalist id="l-marca">{unicos(todos, "marca").map(v => <option key={v} value={v} />)}</datalist>
        </section>

        <section className="tarjeta">
          <h2 className="subtitulo">Precio y stock</h2>
          <div className="dos">
            <label className="campo">Precio (CLP)<input inputMode="numeric" value={form.precio_clp} onChange={cambiar("precio_clp")} placeholder="0 = A consultar" /></label>
            <label className="campo">Precio oferta<input inputMode="numeric" value={form.precio_oferta ?? ""} onChange={cambiar("precio_oferta")} placeholder="Opcional" /></label>
          </div>
          <div className="dos">
            <label className="campo">Stock<select value={form.stock} onChange={cambiar("stock")}>{STOCK.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="campo">Estado<input list="l-estado" value={form.estado} onChange={cambiar("estado")} /></label>
          </div>
          <datalist id="l-estado">{[...new Set([...ESTADOS, ...unicos(todos, "estado")])].map(v => <option key={v} value={v} />)}</datalist>
        </section>

        <section className="tarjeta">
          <h2 className="subtitulo">Publicación</h2>
          <label className="check"><input type="checkbox" checked={form.publicado} onChange={cambiar("publicado")} /> Publicado en la web</label>
          <label className="check"><input type="checkbox" checked={form.destacado} onChange={cambiar("destacado")} /> Destacado en la portada</label>
          <label className="campo corto">Orden<input type="number" value={form.orden} onChange={cambiar("orden")} /><small>Menor aparece primero.</small></label>
        </section>

        <section className="tarjeta">
          <h2 className="subtitulo">Descripción y detalles</h2>
          <label className="campo">Opción 1<input value={form.opcion_1} onChange={cambiar("opcion_1")} placeholder="Talla: S | M | L" /></label>
          <label className="campo">Opción 2<input value={form.opcion_2} onChange={cambiar("opcion_2")} placeholder="Color: Blanco | Negro" /></label>
          <label className="campo">Descripción<textarea rows="6" value={form.descripcion} onChange={cambiar("descripcion")} /></label>
          <label className="campo">Tabla de tallas / especificaciones<textarea rows="4" value={form.tabla_tallas} onChange={cambiar("tabla_tallas")} placeholder={"Talla | Largo | Ancho ; S | 65 | 49 ; M | 68 | 52"} />
            <small>Filas separadas por ";" o salto de línea; celdas por "|". La primera fila es el encabezado.</small></label>
          <label className="campo">Nota al pie<textarea rows="2" value={form.detalle_pie} onChange={cambiar("detalle_pie")} /></label>
          <label className="campo">Link de Instagram<input type="url" value={form.instagram} onChange={cambiar("instagram")} placeholder="https://www.instagram.com/p/…" /></label>
        </section>

        {error && <p className="aviso error" role="alert">{error}</p>}
        {aviso && <p className="aviso ok">{aviso}</p>}
        {aviso && <Publicar chico />}
        <div className="acciones">
          <button className="btn principal" disabled={guardando}>{guardando ? "Guardando…" : nuevo ? "Crear producto" : "Guardar cambios"}</button>
          {!nuevo && <button type="button" className="btn peligro" onClick={borrar}>Borrar</button>}
        </div>
      </form>
    </main>
  );
}
