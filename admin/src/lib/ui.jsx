// Piezas compartidas por las páginas
export const ir = ruta => { location.hash = ruta; };
export function Cargando() {
  return <main className="centro"><div className="girando" aria-label="Cargando" /></main>;
}
export const fmt = n => (n < 0 ? "-$" : "$") + Math.abs(Number(n || 0)).toLocaleString("es-CL");
export const hoy = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const fechaCorta = f => f ? f.slice(0, 10).split("-").reverse().join("-") : "";
