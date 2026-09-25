// Piezas compartidas por las páginas
export const ir = ruta => { location.hash = ruta; };
export function Cargando() {
  return <main className="centro"><div className="girando" aria-label="Cargando" /></main>;
}
