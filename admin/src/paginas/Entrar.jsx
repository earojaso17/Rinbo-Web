import { useState } from "react";
import { entrar, mensajeError } from "../lib/datos.js";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setError("");
    try { await entrar(email.trim(), clave); }
    catch (err) { setError(mensajeError(err)); setEnviando(false); }
  }

  return (
    <main className="centro">
      <form className="tarjeta estrecha" onSubmit={enviar}>
        <div className="marca grande"><img src="/logo.png" alt="" width="44" height="44" /><b>RINBŌ</b><small>Admin</small></div>
        <label className="campo">Correo
          <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="campo">Contraseña
          <input type="password" autoComplete="current-password" required value={clave} onChange={e => setClave(e.target.value)} />
        </label>
        {error && <p className="aviso error" role="alert">{error}</p>}
        <button className="btn principal" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
