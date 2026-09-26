import { useEffect, useState } from "react";
import { leerTodo, resumenMensual, exportarExcel, nombreMes, mesDe, mensajeError } from "./datos.js";
import { fmt } from "./ui.jsx";

// Resumen de ventas para Inicio: cifras del mes, dos gráficos de barras (12 meses) y tabla. Todo privado.
const abreviar = n => Math.abs(n) >= 1e6 ? (n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " M" : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + " mil" : String(n);

function Barras({ titulo, datos, valor, formato, nota }) {
  const [activo, setActivo] = useState(null);
  const vals = datos.map(valor);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals), rango = max - min || 1;
  const W = 340, H = 150, arriba = 14, abajo = 20, alto = H - arriba - abajo;
  const y = v => arriba + (max - v) / rango * alto;
  const base = y(0), banda = W / datos.length, ancho = Math.min(18, banda - 6);
  const ultimo = datos.length - 1;
  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: ${datos.map((d, i) => `${nombreMes(d.mes)} ${formato(vals[i])}`).join(", ")}`}
        onMouseLeave={() => setActivo(null)}>
        <line x1="0" x2={W} y1={base} y2={base} className="eje" />
        {datos.map((d, i) => {
          const v = vals[i], x = i * banda + (banda - ancho) / 2, top = Math.min(y(v), base), h = Math.abs(y(v) - base);
          const r = Math.min(4, h), neg = v < 0;
          // Barra con esquinas redondeadas solo en la punta (no en la base)
          const camino = h === 0 ? "" : neg
            ? `M${x},${top} h${ancho} v${h - r} q0,${r} -${r},${r} h-${ancho - 2 * r} q-${r},0 -${r},-${r} Z`
            : `M${x},${top + h} v-${h - r} q0,-${r} ${r},-${r} h${ancho - 2 * r} q${r},0 ${r},${r} v${h - r} Z`;
          return (
            <g key={d.mes} onMouseEnter={() => setActivo(i)} onClick={() => setActivo(i)} className={activo === i ? "activa" : ""}>
              <rect x={i * banda} y={arriba} width={banda} height={alto + abajo} fill="transparent" />
              {camino && <path d={camino} className="barra" />}
              {(i % 2 === ultimo % 2) && <text x={i * banda + banda / 2} y={H - 5} className="mes">{nombreMes(d.mes).split(" ")[0]}</text>}
              {i === ultimo && v !== 0 && activo === null && <text x={i * banda + banda / 2} y={neg ? top + h + 11 : top - 4} className="valor">{abreviar(v)}</text>}
            </g>
          );
        })}
      </svg>
      <p className="tip num" aria-live="polite">
        {activo !== null ? <><b>{nombreMes(datos[activo].mes)}</b> · {formato(vals[activo])}</> : nota}
      </p>
    </figure>
  );
}

export default function Resumen() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [bajando, setBajando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => { leerTodo().then(setDatos).catch(e => setError(mensajeError(e))); }, []);

  async function bajar() {
    setBajando(true); setError(""); setAviso("");
    try { setAviso(`Descargado: ${await exportarExcel()}`); } catch (e) { setError(mensajeError(e)); }
    setBajando(false);
  }

  if (error && !datos) return <p className="aviso error">{error}</p>;
  if (!datos) return <div className="girando" aria-label="Cargando" />;

  const meses = resumenMensual(datos, 12);
  const actual = meses[meses.length - 1];
  const porCobrar = datos.pedidos.reduce((s, p) => s + Math.max(0, p.saldo_clp), 0);
  const sinCosto = meses.reduce((s, m) => s + m.sinCosto, 0);
  const hayPedidos = datos.pedidos.length > 0;

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Resumen <small>{nombreMes(mesDe(new Date()))}</small></h2>
      <div className="cifras num">
        <div><span>Pedidos del mes</span><b>{actual.pedidos}</b></div>
        <div><span>Ventas del mes</span><b>{fmt(actual.ventas)}</b></div>
        <div><span>Ganancia del mes</span><b>{fmt(actual.ganancia)}</b></div>
        <div><span>Por cobrar (todos)</span><b>{fmt(porCobrar)}</b></div>
      </div>
      {hayPedidos ? (
        <>
          <Barras titulo="Pedidos por mes" datos={meses} valor={m => m.pedidos} formato={v => `${v} pedido(s)`} nota="Toca una barra para ver el detalle." />
          <Barras titulo="Ganancia por mes" datos={meses} valor={m => m.ganancia} formato={fmt}
            nota={sinCosto ? `${sinCosto} pedido(s) sin costo registrado no se cuentan en la ganancia.` : "Venta − costo − impuestos."} />
          <details>
            <summary className="ayuda">Ver tabla por mes</summary>
            <div className="tabla-scroll">
              <table className="tabla num">
                <thead><tr><th>Mes</th><th>Pedidos</th><th>Ventas</th><th>Ganancia</th><th>Cobrado</th></tr></thead>
                <tbody>{[...meses].reverse().map(m => (
                  <tr key={m.mes}><td>{nombreMes(m.mes)}</td><td>{m.pedidos}</td><td>{fmt(m.ventas)}</td><td>{fmt(m.ganancia)}</td><td>{fmt(m.cobrado)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        </>
      ) : <p className="ayuda">Los gráficos aparecerán cuando tengas pedidos.</p>}
      <button className="btn" onClick={bajar} disabled={bajando}>{bajando ? "Preparando…" : "⬇ Descargar Excel"}</button>
      <p className="ayuda">Un archivo con pedidos, artículos, pagos, clientes, productos y resumen por mes. Sirve también como respaldo.</p>
      {aviso && <p className="aviso ok">{aviso}</p>}
      {error && <p className="aviso error">{error}</p>}
    </section>
  );
}
