import { useEffect, useState } from "react";
import { socket } from "../../lib/socket";

const CAPACIDAD = { "1v1": 2, "2v2": 4, "3v3": 6 };

export default function WaitingRoom({ lobby, onIniciar }) {
  const [jugadores, setJugadores] = useState(lobby.jugadores);

  useEffect(() => {
    socket.on("lobby:jugadores", setJugadores);
    socket.on("juego:iniciado", onIniciar);
    return () => {
      socket.off("lobby:jugadores", setJugadores);
      socket.off("juego:iniciado", onIniciar);
    };
  }, []);

  const completo = jugadores.length === CAPACIDAD[lobby.modo];

  function iniciar() {
    socket.emit("lobby:iniciar", lobby.id, () => {});
  }

  return (
    <div className="panel">
      <h2 className="titulo">Sala: {lobby.nombre}</h2>
      <p>Modo: {lobby.modo} — Puntaje: {lobby.puntajeLimite || 30} tantos — Código: <b>{lobby.id}</b></p>
      <h3>Jugadores ({jugadores.length}/{CAPACIDAD[lobby.modo]})</h3>
      <ul>
        {jugadores.map((j) => <li key={j.id}>{j.nombre} — Equipo {j.equipo}</li>)}
      </ul>
      <button className="btn" disabled={!completo} onClick={iniciar}>
        {completo ? "Iniciar partida" : "Esperando jugadores..."}
      </button>
    </div>
  );
}
