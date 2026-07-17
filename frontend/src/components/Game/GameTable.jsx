import { useEffect, useState } from "react";
import { socket } from "../../lib/socket";
import { useTheme } from "../../context/ThemeContext";
import PlayingCard from "./PlayingCard";
import TurnTimer from "./TurnTimer";

export default function GameTable({ lobby, userId, esEspectador = false }) {
  const { diseñoCarta } = useTheme();
  const [estado, setEstado] = useState(null);
  const [finPartida, setFinPartida] = useState(null);
  const [recogiendo, setRecogiendo] = useState(false);

  useEffect(() => {
    socket.on("estado", (e) => {
      setEstado((prev) => {
        if (prev && prev.manoIndex !== e.manoIndex) {
          setRecogiendo(true);
          setTimeout(() => setRecogiendo(false), 500);
        }
        return e;
      });
    });
    socket.on("fin-partida", setFinPartida);
    return () => {
      socket.off("estado");
      socket.off("fin-partida", setFinPartida);
    };
  }, []);

  if (!estado) return <p>Repartiendo cartas...</p>;

  const jugadores = lobby.jugadores;
  const esMiTurno = !esEspectador && estado.turno === userId;
  const miEquipo = jugadores.find((j) => j.id === userId)?.equipo;
  const cantoPendiente = estado.estadoCanto && !estado.estadoCanto.respondido;
  const puedoResponderCanto = !esEspectador && cantoPendiente && estado.estadoCanto.equipoQueResponde === miEquipo;

  function jugarCarta(cartaId) {
    if (esEspectador) return;
    socket.emit("juego:jugar-carta", { lobbyId: lobby.id, cartaId });
  }
  function cantarTruco() { socket.emit("juego:cantar-truco", { lobbyId: lobby.id }); }
  function responderTruco(q) { socket.emit("juego:responder-truco", { lobbyId: lobby.id, quiero: q }); }
  function cantarEnvido(tipo) { socket.emit("juego:cantar-envido", { lobbyId: lobby.id, tipo }); }
  function responderEnvido(q) { socket.emit("juego:responder-envido", { lobbyId: lobby.id, quiero: q }); }
  function cantarFlor(tipo) { socket.emit("juego:cantar-flor", { lobbyId: lobby.id, tipo }); }
  function responderFlor(q) { socket.emit("juego:responder-flor", { lobbyId: lobby.id, quiero: q }); }
  function siguienteMano() { socket.emit("juego:siguiente-mano", { lobbyId: lobby.id }); }

  function responder(q) {
    const t = estado.estadoCanto.tipo;
    if (t === "truco") responderTruco(q);
    else if (t === "flor") responderFlor(q);
    else responderEnvido(q);
  }

  if (finPartida) {
    return (
      <div className="panel" style={{ textAlign: "center" }}>
        <h2 className="titulo">¡Partida terminada!</h2>
        <p>Ganó el equipo {finPartida.ganador} ({finPartida.puntos.A} - {finPartida.puntos.B})</p>
      </div>
    );
  }

  function Asiento({ j }) {
    const esYo = !esEspectador && j.id === userId;
    return (
      <div className={`asiento ${esYo ? "asiento-yo" : ""}`}>
        <div className="nombre-jugador">
          <span className={j.equipo === "A" ? "chip-equipo-a" : "chip-equipo-b"}>{j.nombre}</span>
          {lobby.jugadores[estado.manoIndex]?.id === j.id && <span className="icono-mano" title="Es mano">M</span>}
          {estado.turno === j.id && <span className="icono-turno" title="Turno">👉</span>}
        </div>
        <div className={`fila-cartas ${recogiendo ? "recogiendo" : ""}`}>
          {(estado.manos[j.id] || []).map((carta, i) => (
            <div key={carta?.id || `${j.id}-${i}`} className="carta-repartida" style={{ animationDelay: `${i * 0.08}s` }}>
              <PlayingCard
                carta={carta}
                tapada={!carta}
                jugable={esYo && esMiTurno && !cantoPendiente && !!carta}
                onClick={() => carta && jugarCarta(carta.id)}
                diseño={diseñoCarta}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const CentroMesa = () => (
    <div className="centro-mesa">
      {estado.cartasJugadas.map((cj, i) => {
        const nombreJ = jugadores.find((j) => j.id === cj.jugadorId)?.nombre || "";
        return (
          <div key={`${cj.carta.id}-${i}`} className="carta-jugada-anim">
            <PlayingCard carta={cj.carta} diseño={diseñoCarta} />
            <div className="etiqueta-jugada">{nombreJ}</div>
          </div>
        );
      })}
    </div>
  );

  // 1v1: rival arriba, jugadas en el medio, yo abajo (o los 2 jugadores en fila si espectador)
  const esUno = lobby.modo === "1v1";
  let contenidoMesa;
  if (esUno && !esEspectador) {
    const rival = jugadores.find((j) => j.id !== userId);
    const yo = jugadores.find((j) => j.id === userId);
    contenidoMesa = (
      <div className="mesa-1v1">
        {rival && <Asiento j={rival} />}
        <CentroMesa />
        {yo && <Asiento j={yo} />}
      </div>
    );
  } else if (esUno && esEspectador) {
    contenidoMesa = (
      <div className="mesa-1v1">
        <Asiento j={jugadores[1]} />
        <CentroMesa />
        <Asiento j={jugadores[0]} />
      </div>
    );
  } else {
    contenidoMesa = (
      <div className="mesa-equipos">
        <div className="fila-equipo">
          {jugadores.filter((j) => j.equipo === "B").map((j) => <Asiento key={j.id} j={j} />)}
        </div>
        <CentroMesa />
        <div className="fila-equipo">
          {jugadores.filter((j) => j.equipo === "A").map((j) => <Asiento key={j.id} j={j} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {esEspectador && <p className="panel" style={{ textAlign: "center", marginBottom: "0.5rem" }}>👁 Estás espectando — ves todas las cartas</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span className="marcador">Equipo A: {estado.puntos.A} pts</span>
        <TurnTimer activo={esMiTurno && !cantoPendiente} segundos={20} resetKey={estado.turno} />
        <span className="marcador">Equipo B: {estado.puntos.B} pts</span>
      </div>

      <div className="mesa">
        {estado.muestra && (
          <div className="muestra-zona">
            <div className="mazo-tapado" />
            <PlayingCard carta={estado.muestra} diseño={diseñoCarta} className="carta-muestra" />
          </div>
        )}
        {contenidoMesa}
      </div>

      {!esEspectador && (cantoPendiente ? (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Canto: <b>{estado.estadoCanto.nivel}</b> ({estado.estadoCanto.tipo})</p>
          {puedoResponderCanto ? (
            <>
              <button className="btn" onClick={() => responder(true)}>Quiero</button>
              <button className="btn btn-secundario" onClick={() => responder(false)}>No quiero</button>
            </>
          ) : (
            <p className="texto-suave">Esperando respuesta del rival...</p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button className="btn" onClick={cantarTruco}>Truco</button>
          <button className="btn" onClick={() => cantarEnvido("envido")}>Envido</button>
          <button className="btn" onClick={() => cantarEnvido("real-envido")}>Real Envido</button>
          <button className="btn" onClick={() => cantarEnvido("falta-envido")}>Falta Envido</button>
          {estado.tengoFlor && <button className="btn" onClick={() => cantarFlor("flor")}>🌸 Flor</button>}
          {estado.tengoFlor && <button className="btn" onClick={() => cantarFlor("contraflor")}>Contraflor</button>}
        </div>
      ))}

      {estado.manoTerminada && !esEspectador && (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Ganó la mano el equipo {estado.ganadorMano}</p>
          <button className="btn" onClick={siguienteMano}>Siguiente mano</button>
        </div>
      )}
    </div>
  );
}