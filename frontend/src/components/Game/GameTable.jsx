import { useEffect, useState } from "react";
import { socket } from "../../lib/socket";
import { useTheme } from "../../context/ThemeContext";
import PlayingCard from "./PlayingCard";
import TurnTimer from "./TurnTimer";

export default function GameTable({ lobby, userId }) {
  const { diseñoCarta } = useTheme();
  const [estado, setEstado] = useState(null);
  const [finPartida, setFinPartida] = useState(null);

  useEffect(() => {
    socket.on("estado", setEstado);
    socket.on("fin-partida", setFinPartida);
    return () => {
      socket.off("estado", setEstado);
      socket.off("fin-partida", setFinPartida);
    };
  }, []);

  if (!estado) return <p>Cargando mesa...</p>;

  const jugadores = lobby.jugadores;
  const esMiTurno = estado.turno === userId;
  const cantoPendiente = estado.estadoCanto && !estado.estadoCanto.respondido;
  const puedoResponderCanto = cantoPendiente; // cualquiera del equipo rival puede responder (simplificado en UI)

  function jugarCarta(cartaId) {
    socket.emit("juego:jugar-carta", { lobbyId: lobby.id, cartaId });
  }
  function cantarTruco() { socket.emit("juego:cantar-truco", { lobbyId: lobby.id }); }
  function responderTruco(q) { socket.emit("juego:responder-truco", { lobbyId: lobby.id, quiero: q }); }
  function cantarEnvido(tipo) { socket.emit("juego:cantar-envido", { lobbyId: lobby.id, tipo }); }
  function responderEnvido(q) { socket.emit("juego:responder-envido", { lobbyId: lobby.id, quiero: q }); }
  function siguienteMano() { socket.emit("juego:siguiente-mano", { lobbyId: lobby.id }); }

  if (finPartida) {
    return (
      <div className="panel" style={{ textAlign: "center" }}>
        <h2 className="titulo">¡Partida terminada!</h2>
        <p>Ganó el equipo {finPartida.ganador} ({finPartida.puntos.A} - {finPartida.puntos.B})</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span>Equipo A: {estado.puntos.A} pts</span>
        <TurnTimer activo={esMiTurno && !cantoPendiente} segundos={20} resetKey={estado.turno} />
        <span>Equipo B: {estado.puntos.B} pts</span>
      </div>

      <div className="mesa">
        {jugadores.map((j) => (
          <div key={j.id} style={{ margin: "0.5rem", display: "inline-block" }}>
            <div>
              {j.nombre} {estado.manoIndex !== undefined && lobby.jugadores[estado.manoIndex]?.id === j.id && (
                <span className="icono-mano" title="Mano">M</span>
              )}
              {estado.turno === j.id && <span title="Turno"> 👉</span>}
            </div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {(estado.manos[j.id] || []).map((carta, i) => (
                <PlayingCard
                  key={i}
                  carta={carta}
                  tapada={!carta}
                  jugable={j.id === userId && esMiTurno && !cantoPendiente && !!carta}
                  onClick={() => carta && jugarCarta(carta.id)}
                  diseño={diseñoCarta}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1rem" }}>
          {estado.cartasJugadas.map((cj, i) => (
            <PlayingCard key={i} carta={cj.carta} diseño={diseñoCarta} />
          ))}
        </div>
      </div>

      {cantoPendiente ? (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Canto: <b>{estado.estadoCanto.nivel}</b> ({estado.estadoCanto.tipo})</p>
          <button className="btn" onClick={() => estado.estadoCanto.tipo === "truco" ? responderTruco(true) : responderEnvido(true)}>Quiero</button>
          <button className="btn btn-secundario" onClick={() => estado.estadoCanto.tipo === "truco" ? responderTruco(false) : responderEnvido(false)}>No quiero</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button className="btn" onClick={cantarTruco}>Truco</button>
          <button className="btn" onClick={() => cantarEnvido("envido")}>Envido</button>
          <button className="btn" onClick={() => cantarEnvido("real-envido")}>Real Envido</button>
          <button className="btn" onClick={() => cantarEnvido("falta-envido")}>Falta Envido</button>
        </div>
      )}

      {estado.manoTerminada && (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Ganó la mano el equipo {estado.ganadorMano}</p>
          <button className="btn" onClick={siguienteMano}>Siguiente mano</button>
        </div>
      )}
    </div>
  );
}
