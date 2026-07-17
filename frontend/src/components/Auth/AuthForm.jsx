import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function AuthForm() {
  const { registrarse, iniciarSesion } = useAuth();
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (modo === "login") await iniciarSesion(email, password);
      else await registrarse(email, password, nombre);
    } catch (err) {
      setError(err.message || "Error de autenticación");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 380, margin: "4rem auto" }}>
      <h1 className="titulo" style={{ textAlign: "center" }}>🃏 Truco Uruguayo</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {modo === "registro" && (
          <input placeholder="Nombre de usuario" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
