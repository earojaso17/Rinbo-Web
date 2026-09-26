import { useEffect, useMemo, useState } from "react";
import { leerTodo, exportarExcel, conCostos, mensajeError } from "./datos.js";
import { rango, resumenPeriodo, diaChile, hoyChile } from "./periodos.js";
import { fmt } from "./ui.jsx";

// Resumen de ventas para Inicio: filtro de período, cifras, dos gráficos de barras y tabla. Todo privado.
const abreviar = n => Math.abs(n) >= 1e6 ? (n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " M" : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + " mil" : String(n);
const TIPOS = [["mes", "Mes"], ["trimestre", "Trimestre"], ["ano", "Año"], ["personalizado", "Personalizado"], ["todo", "Todo"]];

function Barras({ titulo, datos, valor, formato, nota }) {
  const [activo, setActivo] = useState(null);
  useEffect(() => setActivo(null), [datos]);
  const vals = datos.map(valor);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals), rango = max - min || 1;
  const W = 340, H = 150, arriba = 14, abajo = 20, alto = H - arriba - abajo;
  const y = v => arriba + (max - v) / rango * alto;
  const base = y(0), banda = W / datos.length, ancho = Math.max(2, Math.min(18, banda - (banda > 8 ? 4 : 1)));
  const ultimo = datos.length - 1, paso = Math.max(1, Math.ceil(datos.length / 8));
  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: ${datos.map((d, i) => `${d.larga} ${formato(vals[i])}`).join(", ")}`}
        onMouseLeave={() => setActivo(null)}>
        <line x1="0" x2={W} y1={base} y2={base} className="eje" />
        {datos.map((d, i) => {
          const v = vals[i], x = i * banda + (banda - ancho) / 2, top = Math.min(y(v), base), h = Math.abs(y(v) - base);
          const r = Math.min(4, h, ancho / 2), neg = v < 0;
          // Barra con esquinas redondeadas solo en la punta (no en la base)
          const camino = h === 0 ? "" : neg
            ? `M${x},${top} h${ancho} v${h - r} q0,${r} -${r},${r} h-${ancho - 2 * r} q-${r},0 -${r},-${r} Z`
            : `M${x},${top + h} v-${h - r} q0,-${r} ${r},-${r} h${ancho - 2 * r} q${r},0 ${r},${r} v${h - r} Z`;
          return (
            <g key={d.clave} onMouseEnter={() => setActivo(i)} onClick={() => setActivo(i)} className={activo === i ? "activa" : ""}>
              <rect x={i * banda} y={arriba} width={banda} height={alto + abajo} fill="transparent" />
              {camino && <path d={camino} className="barra" />}
              {(ultimo - i) % paso === 0 && <text x={i * banda + banda / 2} y={H - 5} className="mes">{d.corta}</text>}
            </g>
          );
        })}
      </svg>
      <p className="tip num" aria-live="polite">
        {activo !== null ? <><b>{datos[activo].larga}</b> · {formato(vals[activo])}</> : nota}
      </p>
    </figure>
  );
}

export default function Resumen() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [bajando, setBajando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tipo, setTipo] = useState("mes");
  const [paso, setPaso] = useState(0);
  const [desde, setDesde] = useState(() => hoyChile().slice(0, 8) + "01");
  const [hasta, setHasta] = useState(hoyChile);

  useEffect(() => { leerTodo().then(setDatos).catch(e => setError(mensajeError(e))); }, []);

  const primeraFecha = useMemo(() => {
    if (!datos) return null;
    const f = [...datos.pedidos.map(p => diaChile(p.creado_en)), ...datos.pagos.map(g => g.fecha)].sort()[0];
    return f || null;
  }, [datos]);
  const periodo = rango(tipo, paso, { desde, hasta, primeraFecha });
  const res = useMemo(() => datos && resumenPeriodo(datos, periodo, conCostos), [datos, periodo.desde, periodo.hasta]);

  async function bajar() {
    setBajando(true); setError(""); setAviso("");
    try { setAviso(`Descargado: ${await exportarExcel()}`); } catch (e) { setError(mensajeError(e)); }
    setBajando(false);
  }

  if (error && !datos) return <p className="aviso error">{error}</p>;
  if (!datos) return <div className="girando" aria-label="Cargando" />;

  const { total, tramos, porDia } = res;
  const conFlechas = ["mes", "trimestre", "ano"].includes(tipo);
  const unidad = porDia ? "día" : "mes";

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Resumen</h2>
      <div className="chips" role="group" aria-label="Período">
        {TIPOS.map(([k, t]) => <button key={k} className="chip" aria-pressed={tipo === k} onClick={() => { setTipo(k); setPaso(0); }}>{t}</button>)}
      </div>
      {conFlechas && (
        <div className="periodo">
          <button className="flecha" onClick={() => setPaso(p => p - 1)} aria-label="Período anterior">‹</button>
          <b>{periodo.etiqueta}</b>
          <button className="flecha" onClick={() => setPaso(p => p + 1)} disabled={paso >= 0} aria-label="Período siguiente">›</button>
        </div>
      )}
      {tipo === "personalizado" && (
        <div className="dos">
          <label className="campo">Desde<input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} /></label>
          <label className="campo">Hasta<input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} /></label>
        </div>
      )}
      {tipo === "todo" && <p className="ayuda num">Desde {periodo.desde.split("-").reverse().join("-")} hasta hoy.</p>}
      <div className="cifras num">
        <div><span>Pedidos</span><b>{total.pedidos}</b></div>
        <div><span>Ventas</span><b>{fmt(total.ventas)}</b></div>
        <div><span>Ganancia</span><b>{fmt(total.ganancia)}</b></div>
        <div><span>Cobrado</span><b>{fmt(total.cobrado)}</b></div>
      </div>
      <p className="ayuda num">Por cobrar de los pedidos de este período: <b>{fmt(total.porCobrar)}</b></p>
      {total.pedidos > 0 || total.cobrado !== 0 ? (
        <>
          <Barras titulo={`Pedidos por ${unidad}`} datos={tramos} valor={m => m.pedidos} formato={v => `${v} pedido(s)`} nota="Toca una barra para ver el detalle." />
          <Barras titulo={`Ganancia por ${unidad}`} datos={tramos} valor={m => m.ganancia} formato={fmt}
            nota={total.sinCosto ? `${total.sinCosto} pedido(s) sin costo registrado no se cuentan en la ganancia.` : "Venta − costo − impuestos."} />
          <details>
            <summary className="ayuda">Ver tabla por {unidad}</summary>
            <div className="tabla-scroll">
              <table className="tabla num">
                <thead><tr><th>{porDia ? "Día" : "Mes"}</th><th>Pedidos</th><th>Ventas</th><th>Ganancia</th><th>Cobrado</th></tr></thead>
                <tbody>{[...tramos].reverse().filter(m => !porDia || m.pedidos || m.cobrado).map(m => (
                  <tr key={m.clave}><td>{m.larga}</td><td>{m.pedidos}</td><td>{fmt(m.ventas)}</td><td>{fmt(m.ganancia)}</td><td>{fmt(m.cobrado)}</td></tr>
                ))}</tbody>
                <tfoot><tr><td>Total</td><td>{total.pedidos}</td><td>{fmt(total.ventas)}</td><td>{fmt(total.ganancia)}</td><td>{fmt(total.cobrado)}</td></tr></tfoot>
              </table>
            </div>
          </details>
        </>
      ) : <p className="ayuda">No hay pedidos ni pagos en este período.</p>}
      <button className="btn" onClick={bajar} disabled={bajando}>{bajando ? "Preparando…" : "⬇ Descargar Excel"}</button>
      <p className="ayuda">Un archivo con pedidos, artículos, pagos, clientes, productos y resumen por mes (todo el tiempo). Sirve también como respaldo.</p>
      {aviso && <p className="aviso ok">{aviso}</p>}
      {error && <p className="aviso error">{error}</p>}
    </section>
  );
}
