// Períodos del resumen de Inicio (fechas en hora de Chile, como texto "AAAA-MM-DD")
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const diaChile = f => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(f));
export const hoyChile = () => diaChile(new Date());
const dos = n => String(n).padStart(2, "0");
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();   // m = 1..12

// tipo: "mes" | "trimestre" | "ano" | "todo" | "personalizado"; paso: 0 = actual, -1 = anterior…
export function rango(tipo, paso = 0, { desde, hasta, primeraFecha } = {}) {
  const [a0, m0] = hoyChile().split("-").map(Number);
  if (tipo === "mes") {
    const t = a0 * 12 + (m0 - 1) + paso, a = Math.floor(t / 12), m = t % 12 + 1;
    return { desde: `${a}-${dos(m)}-01`, hasta: `${a}-${dos(m)}-${ultimoDia(a, m)}`, etiqueta: `${MESES_LARGOS[m - 1]} ${a}` };
  }
  if (tipo === "trimestre") {
    const t = a0 * 4 + Math.floor((m0 - 1) / 3) + paso, a = Math.floor(t / 4), q = t % 4, mi = q * 3 + 1, mf = mi + 2;
    return { desde: `${a}-${dos(mi)}-01`, hasta: `${a}-${dos(mf)}-${ultimoDia(a, mf)}`, etiqueta: `${q + 1}.º trimestre ${a} (${MESES[mi - 1]}–${MESES[mf - 1]})` };
  }
  if (tipo === "ano") { const a = a0 + paso; return { desde: `${a}-01-01`, hasta: `${a}-12-31`, etiqueta: `Año ${a}` }; }
  if (tipo === "personalizado") {
    const d = desde || hoyChile(), h = hasta || hoyChile();
    return d <= h ? { desde: d, hasta: h, etiqueta: "Personalizado" } : { desde: h, hasta: d, etiqueta: "Personalizado" };
  }
  return { desde: primeraFecha || hoyChile(), hasta: hoyChile(), etiqueta: "Todo el tiempo" };
}

// Tramos del gráfico: por día si el período dura hasta 62 días, si no por mes
function tramos(desde, hasta) {
  const d0 = new Date(desde + "T12:00:00Z"), d1 = new Date(hasta + "T12:00:00Z");
  const dias = Math.round((d1 - d0) / 864e5) + 1;
  const lista = [];
  if (dias <= 62) {
    for (let i = 0; i < dias; i++) {
      const k = new Date(d0.getTime() + i * 864e5).toISOString().slice(0, 10), [a, m, d] = k.split("-");
      lista.push({ clave: k, corta: String(+d), larga: `${+d} ${MESES[+m - 1]} ${a}` });
    }
    return { porDia: true, lista };
  }
  let [a, m] = desde.split("-").map(Number); const [af, mf] = hasta.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    lista.push({ clave: `${a}-${dos(m)}`, corta: MESES[m - 1], larga: `${MESES_LARGOS[m - 1]} ${a}` });
    if (++m > 12) { m = 1; a++; }
  }
  return { porDia: false, lista };
}

export function resumenPeriodo({ pedidos, pagos }, { desde, hasta }, conCostos) {
  const { porDia, lista } = tramos(desde, hasta);
  const t = Object.fromEntries(lista.map(x => [x.clave, { ...x, pedidos: 0, ventas: 0, ganancia: 0, sinCosto: 0, cobrado: 0 }]));
  const clave = dia => porDia ? dia : dia.slice(0, 7);
  const tot = { pedidos: 0, ventas: 0, ganancia: 0, sinCosto: 0, cobrado: 0, porCobrar: 0 };
  for (const p of pedidos) {
    const dia = diaChile(p.creado_en);
    if (dia < desde || dia > hasta) continue;
    const x = t[clave(dia)];
    const g = conCostos(p) ? p.utilidad_clp : 0, sc = !conCostos(p) && p.total_clp > 0 ? 1 : 0;
    for (const o of [x, tot]) if (o) { o.pedidos++; o.ventas += p.total_clp; o.ganancia += g; o.sinCosto += sc; }
    tot.porCobrar += Math.max(0, p.saldo_clp);
  }
  for (const g of pagos) {
    if (g.fecha < desde || g.fecha > hasta) continue;
    const x = t[clave(g.fecha)]; if (x) x.cobrado += g.monto_clp; tot.cobrado += g.monto_clp;
  }
  return { porDia, tramos: lista.map(x => t[x.clave]), total: tot };
}
