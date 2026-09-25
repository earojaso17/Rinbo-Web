import { useEffect, useState } from "react";
import { supabase, esAdmin, salir, mensajeError } from "./lib/datos.js";
import Entrar from "./paginas/Entrar.jsx";
import Inicio from "./paginas/Inicio.jsx";
import Productos from "./paginas/Productos.jsx";
import ProductoForm from "./paginas/ProductoForm.jsx";
import Pedidos from "./paginas/Pedidos.jsx";
import PedidoNuevo from "./paginas/PedidoNuevo.jsx";
import PedidoDetalle from "./paginas/PedidoDetalle.jsx";
import Clientes from "./paginas/Clientes.jsx";
import ClienteForm from "./paginas/ClienteForm.jsx";
import { Cargando } from "./lib/ui.jsx";

// Rutas con # (funciona en cualquier hosting estático): #/ · #/productos[/nuevo|/<id>] · #/pedidos[/nuevo?cliente=<id>|/<id>] · #/clientes[/nuevo|/<id>]
function leerRuta() {
  const [camino, consulta = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const partes = decodeURIComponent(camino).split("/").filter(Boolean);
  return { seccion: partes[0] || "inicio", id: partes[1] || null, params: new URLSearchParams(consulta) };
}

export default function App() {
  const [sesion, setSesion] = useState(undefined); // undefined = cargando
  const [admin, setAdmin] = useState(null);        // null = revisando
  const [error, setError] = useState("");
  const [ruta, setRuta] = useState(leerRuta());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    const alCambiar = () => { setRuta(leerRuta()); window.scrollTo(0, 0); };
    addEventListener("hashchange", alCambiar);
    return () => { data.subscription.unsubscribe(); removeEventListener("hashchange", alCambiar); };
  }, []);

  useEffect(() => {
    if (!sesion) { setAdmin(null); return; }
    esAdmin().then(setAdmin).catch(e => { setError(mensajeError(e)); setAdmin(false); });
  }, [sesion?.user?.id]);

  if (sesion === undefined) return <Cargando />;
  if (!sesion) return <Entrar />;
  if (admin === null) return <Cargando />;
  if (!admin) {
    return (
      <main className="centro">
        <div className="tarjeta estrecha">
          <h1 className="titulo">Sin acceso</h1>
          <p>{error || `La cuenta ${sesion.user.email} no es administradora de RINBŌ.`}</p>
          <button className="btn" onClick={salir}>Salir</button>
        </div>
      </main>
    );
  }

  let pagina;
  if (ruta.seccion === "productos" && ruta.id) pagina = <ProductoForm key={ruta.id} id={ruta.id === "nuevo" ? null : ruta.id} />;
  else if (ruta.seccion === "productos") pagina = <Productos />;
  else if (ruta.seccion === "pedidos" && ruta.id === "nuevo") pagina = <PedidoNuevo key={location.hash} clienteInicial={ruta.params.get("cliente")} />;
  else if (ruta.seccion === "pedidos" && ruta.id) pagina = <PedidoDetalle key={ruta.id} id={ruta.id} />;
  else if (ruta.seccion === "pedidos") pagina = <Pedidos />;
  else if (ruta.seccion === "clientes" && ruta.id) pagina = <ClienteForm key={ruta.id} id={ruta.id === "nuevo" ? null : ruta.id} />;
  else if (ruta.seccion === "clientes") pagina = <Clientes />;
  else pagina = <Inicio correo={sesion.user.email} />;

  return (
    <>
      <header className="barra">
        <a className="marca" href="#/"><img src="/logo.png" alt="" width="30" height="30" /><b>RINBŌ</b><small>Admin</small></a>
        <button className="enlace" onClick={salir}>Salir</button>
      </header>
      <div className="contenido">{pagina}</div>
      <nav className="menu-inferior" aria-label="Secciones">
        <a href="#/" aria-current={ruta.seccion === "inicio" ? "page" : undefined}><span className="jp">家</span>Inicio</a>
        <a href="#/productos" aria-current={ruta.seccion === "productos" ? "page" : undefined}><span className="jp">品</span>Productos</a>
        <a href="#/pedidos" aria-current={ruta.seccion === "pedidos" ? "page" : undefined}><span className="jp">注</span>Pedidos</a>
        <a href="#/clientes" aria-current={ruta.seccion === "clientes" ? "page" : undefined}><span className="jp">客</span>Clientes</a>
      </nav>
    </>
  );
}
