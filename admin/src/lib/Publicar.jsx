import { useEffect, useRef, useState } from "react";
import { publicarAhora, estadoPublicacion, mensajeError } from "./datos.js";

// Botón "Publicar cambios ahora": pide al robot actualizar rinbo.store y muestra el avance (1–3 minutos).
export default function Publicar({ chico = false }) {
  const [fase, setFase] = useState("listo"); // listo · pidiendo · publicando · ok · error
  const [mensaje, setMensaje] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);

  function vigilar(desde) {
    clearInterval(timer.current);
    let vueltas = 0;
    timer.current = setInterval(async () => {
      vueltas++;
      try {
        const { ultima } = await estadoPublicacion();
        if (ultima && new Date(ultima.creado) >= new Date(desde) - 60000) {
          if (ultima.estado === "completed") {
            clearInterval(timer.current);
            if (ultima.resultado === "success") { setFase("ok"); setMensaje("Listo: rinbo.store ya tiene tus cambios (recarga la página para verlos)."); }
            else { setFase("error"); setMensaje("El robot terminó con un problema. Vuelve a intentar o avísale a Claude."); }
            return;
          }
        }
      } catch { /* sigue intentando */ }
      if (vueltas > 36) { clearInterval(timer.current); setFase("error"); setMensaje("Está tardando más de lo normal. Revisa en unos minutos."); }
    }, 5000);
  }

  async function publicar() {
    setFase("pidiendo"); setMensaje("");
    try {
      const r = await publicarAhora();
      setFase("publicando");
      setMensaje(r.yaEnCurso ? "Ya había una publicación en curso; esperando que termine…" : "Publicando… tarda 1 a 3 minutos. Puedes seguir trabajando.");
      vigilar(r.pedido || r.ultima?.creado || new Date().toISOString());
    } catch (e) { setFase("error"); setMensaje(mensajeError(e)); }
  }

  const ocupado = fase === "pidiendo" || fase === "publicando";
  return (
    <div className="publicar">
      <button type="button" className={"btn " + (chico ? "chico" : "principal ancho")} onClick={publicar} disabled={ocupado}>
        {ocupado ? "Publicando…" : "Publicar cambios ahora"}
      </button>
      {mensaje && <p className={"aviso " + (fase === "ok" ? "ok" : fase === "error" ? "error" : "")} role="status">{mensaje}</p>}
    </div>
  );
}
