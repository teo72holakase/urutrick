import { useEffect, useRef, useState } from "react";
import { socket } from "../../lib/socket";
import PlayingCard from "./PlayingCard";
import TurnTimer from "./TurnTimer";

// IMPORTANTE: Asiento y CentroMesa van FUERA de GameTable (a nivel de módulo).
// Si se declaran dentro del cuerpo de GameTable, React las trata como un tipo de
// componente NUEVO en cada re-render (incluida la cuenta regresiva de 6s, que
// actualiza estado cada segundo) y remonta TODO el árbol de cartas de cero,
// repitiendo la animación de reparto una y otra vez. Sacarlas afuera evita eso.

function Asiento({ j, estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos }) {
  const esYo = !esEspectador && j.id === userId;
  const slots = estado.manos[j.id] || [];
  return (
    <div className={`asiento ${esYo ? "asiento-yo" : ""}`}>
      <div className="nombre-jugador">
        {esModoEquipos && <span className={`letra-equipo letra-${j.equipo.toLowerCase()}`}>{j.equipo}</span>}
        <span>{j.nombre}</span>
        {lobby.jugadores[estado.manoIndex]?.id === j.id && <span className="icono-mano" title="Es mano">M</span>}
        {estado.turno === j.id && <span className="icono-turno" title="Turno">👉</span>}
      </div>
      <div className={`fila-cartas ${recogiendo ? "recogiendo" : ""}`}>
        {slots.map((slot, i) => {
          // slot = {jugada:true} -> hueco invisible (ya se jugó esa carta, no achica la fila)
          if (slot && slot.jugada) {
            return <div key={`hueco-${j.id}-${i}`} className="carta-hueco" />;
          }
          const carta = slot; // carta real, o null (oculta del rival)
          return (
            <div key={carta?.id || `${j.id}-${i}`} className="carta-repartida" style={{ animationDelay: `${i * 0.08}s` }}>
              <PlayingCard
                carta={carta}
                tapada={!carta}
                jugable={esYo && esMiTurno && !cantoPendiente && !!carta}
                onClick={() => carta && jugarCarta(carta.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CentroMesa({ estado, jugadores }) {
  return (
    <div className="centro-mesa">
      {estado.cartasJugadas.map((cj, i) => {
        const nombreJ = jugadores.find((j) => j.id === cj.jugadorId)?.nombre || "";
        return (
          <div key={`${cj.carta.id}-${i}`} className="carta-jugada-anim">
            <PlayingCard carta={cj.carta} />
            <div className="etiqueta-jugada">{nombreJ}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function GameTable({ lobby, userId, esEspectador = false, estado, finPartida, onVolverMenu }) {
  const [recogiendo, setRecogiendo] = useState(false);
  const [cuentaMano, setCuentaMano] = useState(6);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const manoIndexRef = useRef(null);
  const cuentaRef = useRef(null);

  useEffect(() => {
    if (!estado) return;
    if (manoIndexRef.current !== null && manoIndexRef.current !== estado.manoIndex) {
      setRecogiendo(true);
      setTimeout(() => setRecogiendo(false), 500);
    }
    manoIndexRef.current = estado.manoIndex;
  }, [estado?.manoIndex]);

  useEffect(() => {
    clearInterval(cuentaRef.current);
    if (estado?.manoTerminada) {
      setCuentaMano(6);
      cuentaRef.current = setInterval(() => setCuentaMano((c) => (c > 0 ? c - 1 : 0)), 1000);
    }
    return () => clearInterval(cuentaRef.current);
  }, [estado?.manoTerminada, estado?.manoIndex]);

  if (!estado) return <p style={{ textAlign: "center" }}>Repartiendo cartas...</p>;

  const jugadores = lobby.jugadores;
  const esUno = lobby.modo === "1v1";
  const esMiTurno = !esEspectador && estado.turno === userId;
  const miEquipo = jugadores.find((j) => j.id === userId)?.equipo;
  const cantoPendiente = estado.estadoCanto && !estado.estadoCanto.respondido;
  const puedoResponderCanto = !esEspectador && cantoPendiente && estado.estadoCanto.equipoQueResponde === miEquipo;
  const nombreEquipoA = esUno ? (jugadores.find((j) => j.equipo === "A")?.nombre || "Equipo A") : "Equipo A";
  const nombreEquipoB = esUno ? (jugadores.find((j) => j.equipo === "B")?.nombre || "Equipo B") : "Equipo B";

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
        <p>Ganó {esUno ? (finPartida.ganador === "A" ? nombreEquipoA : nombreEquipoB) : `el equipo ${finPartida.ganador}`} ({finPartida.puntos.A} - {finPartida.puntos.B})</p>
        <button className="btn" onClick={onVolverMenu}>Volver al menú</button>
      </div>
    );
  }

  const asientoProps = { estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos: !esUno };
  let contenidoMesa;
  if (esUno && !esEspectador) {
    const rival = jugadores.find((j) => j.id !== userId);
    const yo = jugadores.find((j) => j.id === userId);
    contenidoMesa = (
      <div className="mesa-1v1">
        {rival && <Asiento j={rival} {...asientoProps} />}
        <CentroMesa estado={estado} jugadores={jugadores} />
        {yo && <Asiento j={yo} {...asientoProps} />}
      </div>
    );
  } else if (esUno && esEspectador) {
    contenidoMesa = (
      <div className="mesa-1v1">
        <Asiento j={jugadores[1]} {...asientoProps} />
        <CentroMesa estado={estado} jugadores={jugadores} />
        <Asiento j={jugadores[0]} {...asientoProps} />
      </div>
    );
  } else {
    // Mi equipo siempre abajo (cerca mío), el rival siempre arriba — igual para
    // cualquier jugador, así ambos lados ven el mismo tipo de tablero (antes
    // "Equipo B" quedaba fijo arriba para todos, y por eso un lado veía su
    // propia fila de reversos distinto que el otro).
    const abajo = esEspectador ? "A" : miEquipo;
    const arriba = abajo === "A" ? "B" : "A";
    contenidoMesa = (
      <div className="mesa-equipos">
        <div className="fila-equipo">
          {jugadores.filter((j) => j.equipo === arriba).map((j) => <Asiento key={j.id} j={j} {...asientoProps} />)}
        </div>
        <CentroMesa estado={estado} jugadores={jugadores} />
        <div className="fila-equipo">
          {jugadores.filter((j) => j.equipo === abajo).map((j) => <Asiento key={j.id} j={j} {...asientoProps} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {esEspectador && (
        <div className="panel" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          👁 Estás espectando — ves todas las cartas
          <div><button className="btn btn-secundario" style={{ marginTop: "0.5rem" }} onClick={onVolverMenu}>Volver al menú</button></div>
        </div>
      )}
      <div className="marcador-fila">
        <span className="marcador">{nombreEquipoA}: {estado.puntos.A} pts</span>
        <TurnTimer activo={esMiTurno && !cantoPendiente} segundos={20} resetKey={estado.turno} />
        <span className="marcador">{nombreEquipoB}: {estado.puntos.B} pts</span>
      </div>
      <p className="texto-suave" style={{ textAlign: "center", margin: "0 0 0.5rem" }}>
        Partida a {lobby.puntajeLimite || 30} tantos
        {estado.historialManos.length > 0 && (
          <> · <button className="link-historial" onClick={() => setMostrarHistorial((v) => !v)}>
            {mostrarHistorial ? "ocultar" : "ver"} historial de manos
          </button></>
        )}
      </p>
      {mostrarHistorial && (
        <div className="panel historial-manos">
          {estado.historialManos.slice().reverse().map((h) => (
            <div key={h.numero} className="fila-historial">
              Mano {h.numero}: ganó {esUno ? (h.ganador === "A" ? nombreEquipoA : nombreEquipoB) : `equipo ${h.ganador}`} (+{h.puntos})
            </div>
          ))}
        </div>
      )}

      {!esEspectador && estado.tengoFlor && (
        <div className="banner-flor">🌸 ¡Tenés Flor! Podés cantarla cuando quieras antes de la primera baza.</div>
      )}

      <div className="mesa">
        {estado.muestra && (
          <div className="muestra-zona">
            <div className="mazo-tapado" />
            <PlayingCard carta={estado.muestra} className="carta-muestra" />
          </div>
        )}
        {contenidoMesa}
      </div>

      {!esEspectador && (cantoPendiente ? (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Canto: <b>{estado.estadoCanto.nivel}</b> ({estado.estadoCanto.tipo})</p>
          {puedoResponderCanto ? (
            <div className="acciones-canto">
              <button className="btn" onClick={() => responder(true)}>Quiero</button>
              <button className="btn btn-secundario" onClick={() => responder(false)}>No quiero</button>
            </div>
          ) : (
            <p className="texto-suave">Esperando respuesta del rival...</p>
          )}
        </div>
      ) : (
        <div className="acciones-canto">
          <button className="btn" onClick={cantarTruco}>Truco</button>
          {!estado.envidoBloqueado && (
            <>
              <button className="btn" onClick={() => cantarEnvido("envido")}>Envido</button>
              <button className="btn" onClick={() => cantarEnvido("real-envido")}>Real Envido</button>
              <button className="btn" onClick={() => cantarEnvido("falta-envido")}>Falta Envido</button>
            </>
          )}
          {estado.tengoFlor && <button className="btn" onClick={() => cantarFlor("flor")}>🌸 Flor</button>}
          {estado.tengoFlor && <button className="btn" onClick={() => cantarFlor("contraflor")}>Contraflor</button>}
        </div>
      ))}

      {estado.manoTerminada && (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Ganó la mano {esUno ? (estado.ganadorMano === "A" ? nombreEquipoA : nombreEquipoB) : `el equipo ${estado.ganadorMano}`} — siguiente mano en {cuentaMano}s</p>
        </div>
      )}
    </div>
  );
}