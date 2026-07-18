import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function AuthForm() {
  const { registrarse, iniciarSesion } = useAuth();
  const [modo, setModo] = useState("login");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (modo === "login") await iniciarSesion(usuario, password);
      else await registrarse(usuario, password);
    } catch (err) {
      setError(err.message || "Error de autenticación");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 380, margin: "4rem auto" }}>
      <h1 className="titulo" style={{ textAlign: "center" }}>
        <img src="/urutrick.png" alt="" className="titulo-icono" /> Truco Uruguayo
      </h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <input placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} required minLength={3} />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <span style={{ color: "#e57373" }}>{error}</span>}
        <button className="btn" disabled={cargando}>{modo === "login" ? "Entrar" : "Crear cuenta"}</button>
      </form>
      <p style={{ textAlign: "center", marginTop: "1rem" }}>
        {modo === "login" ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
        <a href="#" onClick={() => setModo(modo === "login" ? "registro" : "login")}>
          {modo === "login" ? "Registrate" : "Iniciá sesión"}
        </a>
      </p>
    </div>
  );
}
