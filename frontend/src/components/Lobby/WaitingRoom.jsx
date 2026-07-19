import { socket } from "../../lib/socket";

const CAPACIDAD = { "1v1": 2, "2v2": 4, "3v3": 6 };

export default function WaitingRoom({ lobby, espectadoresCount = 0 }) {
  const jugadores = lobby.jugadores;
  const completo = jugadores.length === CAPACIDAD[lobby.modo];

  function iniciar() {
    socket.emit("lobby:iniciar", lobby.id, () => {});
  }

  return (
    <div className="panel">
      <h2 className="titulo">Sala: {lobby.nombre}</h2>
      <p>Modo: {lobby.modo} — Puntaje: {lobby.puntajeLimite || 30} tantos — Código: <b>{lobby.id}</b></p>
      <h3>
        Jugadores ({jugadores.length}/{CAPACIDAD[lobby.modo]})
        {espectadoresCount > 0 && <span className="texto-suave" style={{ fontWeight: 400, marginLeft: "0.6rem" }}>👀 {espectadoresCount}</span>}
      </h3>
      <ul>
        {jugadores.map((j) => <li key={j.id}>{j.nombre} — Equipo {j.equipo}</li>)}
      </ul>
      <button className="btn" disabled={!completo} onClick={iniciar}>
        {completo ? "Iniciar partida" : "Esperando jugadores..."}
      </button>
    </div>
  );
}
