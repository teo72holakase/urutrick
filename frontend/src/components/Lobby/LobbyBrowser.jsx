import { useEffect, useState } from "react";
import { socket } from "../../lib/socket";
import CreateLobbyModal from "./CreateLobbyModal";

function ColumnaRanking({ titulo, filas }) {
  return (
    <div className="ranking-col">
      <div className="ranking-col-titulo">{titulo}</div>
      {(!filas || filas.length === 0) && <div className="ranking-vacio">—</div>}
      {(filas || []).map((f, i) => (
        <div key={i} className="ranking-fila">
          <span className="ranking-pos">{i + 1}.</span>
          <span className="ranking-nombre">{f.nombre}</span>
          <span className="ranking-valor">{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ ranking }) {
  return (
    <div className="leaderboard">
      <h3 className="titulo leaderboard-titulo">🏆 Leaderboard</h3>
      <div className="ranking-cols">
        <ColumnaRanking titulo="Manos ganadas" filas={ranking.manos} />
        <ColumnaRanking titulo="Mesas ganadas" filas={ranking.mesas} />
        <ColumnaRanking titulo="Puntos hechos" filas={ranking.puntos} />
      </div>
    </div>
  );
}

export default function LobbyBrowser({ nombreJugador, onEntrarLobby, onEspectar }) {
  const [lobbies, setLobbies]           = useState([]);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [error, setError]               = useState("");
  const [refrescando, setRefrescando]   = useState(false);
  const [ranking, setRanking]           = useState({ manos: [], mesas: [], puntos: [] });

  function refrescar() {
    setRefrescando(true);
    socket.emit("lobby:listar", (lista) => { setLobbies(lista); setRefrescando(false); });
    socket.emit("stats:leaderboard", (r) => r && setRanking(r));
  }

  useEffect(() => {
    socket.emit("lobby:listar", setLobbies);
    socket.emit("stats:leaderboard", (r) => r && setRanking(r));
    socket.on("lobby:actualizado", setLobbies);
    socket.on("stats:actualizado", setRanking);
    return () => {
      socket.off("lobby:actualizado", setLobbies);
      socket.off("stats:actualizado", setRanking);
    };
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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secundario" onClick={refrescar} disabled={refrescando}>
            {refrescando ? "Actualizando…" : "↻ Refrescar"}
          </button>
          <button className="btn" onClick={() => setMostrarCrear(true)}>+ Crear mesa</button>
        </div>
      </div>
      {error && <p style={{ color: "#e57373" }}>{error}</p>}
      {lobbies.length === 0 && <p>No hay mesas abiertas. ¡Creá una!</p>}
      {lobbies.map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--madera-3)" }}>
          <span>{l.nombre} — {l.modo} — a {l.puntajeLimite} tantos — {l.jugadores}/{l.capacidad}{l.espectadores > 0 ? ` 👀${l.espectadores}` : ""} {l.tienePassword ? "🔒" : ""} {l.iniciado ? "🎮 en curso" : ""}</span>
          {!l.iniciado && l.jugadores < l.capacidad
            ? <button className="btn btn-secundario" onClick={() => unirse(l)}>Unirse</button>
            : <button className="btn btn-secundario" onClick={() => onEspectar(l.id)}>👁 Espectar</button>}
        </div>
      ))}
      {mostrarCrear && <CreateLobbyModal onCrear={crear} onClose={() => setMostrarCrear(false)} />}

      <Leaderboard ranking={ranking} />
    </div>
  );
}