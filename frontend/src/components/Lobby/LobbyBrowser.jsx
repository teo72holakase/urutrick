import { useEffect, useState } from "react";
import { socket } from "../../lib/socket";
import CreateLobbyModal from "./CreateLobbyModal";

export default function LobbyBrowser({ nombreJugador, onEntrarLobby, onEspectar }) {
  const [lobbies, setLobbies] = useState([]);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.emit("lobby:listar", setLobbies);
    socket.on("lobby:actualizado", setLobbies);
    return () => socket.off("lobby:actualizado", setLobbies);
  }, []);

  function crear(data) {
    socket.emit("lobby:crear", { ...data, nombre_jugador: nombreJugador }, (res) => {
      if (res.ok) { setMostrarCrear(false); onEntrarLobby(res.lobby); }
      else setError(res.error);
    });
  }

  function unirse(l) {
    const password = l.tienePassword ? (prompt("Esta mesa tiene contraseña:") || "") : "";
    socket.emit("lobby:unirse", { lobbyId: l.id, nombre: nombreJugador, password }, (res) => {
      if (res.ok) onEntrarLobby(res.lobby);
      else setError(res.error);
    });
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="titulo">Mesas disponibles</h2>
        <button className="btn" onClick={() => setMostrarCrear(true)}>+ Crear mesa</button>
      </div>
      {error && <p style={{ color: "#e57373" }}>{error}</p>}
      {lobbies.length === 0 && <p>No hay mesas abiertas. ¡Creá una!</p>}
      {lobbies.map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--madera-3)" }}>
          <span>{l.nombre} — {l.modo} — a {l.puntajeLimite} tantos — {l.jugadores}/{l.capacidad} {l.tienePassword ? "🔒" : ""} {l.iniciado ? "🎮 en curso" : ""}</span>
          {!l.iniciado && l.jugadores < l.capacidad
            ? <button className="btn btn-secundario" onClick={() => unirse(l)}>Unirse</button>
            : <button className="btn btn-secundario" onClick={() => onEspectar(l.id)}>👁 Espectar</button>}
        </div>
      ))}
      {mostrarCrear && <CreateLobbyModal onCrear={crear} onClose={() => setMostrarCrear(false)} />}
    </div>
  );
}