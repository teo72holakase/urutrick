import { useEffect, useRef, useState } from "react";
import { socket } from "../../lib/socket";
import PlayingCard from "./PlayingCard";
import TurnTimer from "./TurnTimer";

const NIVEL_TEXTO = { truco: "Truco", retruco: "Retruco", vale4: "Vale 4" };
const SIGUIENTE_NIVEL = { 0: "truco", 1: "retruco", 2: "vale4" };

function Asiento({ j, estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos }) {
  const esYo = !esEspectador && j.id === userId;
  const slots = estado.manos[j.id] || [];
  return (
    <div className={`asiento ${esYo ? "asiento-yo" : ""}`}>
      <div className="nombre-jugador">
        {esModoEquipos && <span className={`letra-equipo letra-${j.equipo.toLowerCase()}`}>{j.equipo}</span>}
        <span>{j.nombre}</span>
        {lobby.jugadores[estado.manoIndex]?.id === j.id && <span className="icono-mano" title="Es mano">M</span>}
        {!estado.bazaPendiente && estado.turno === j.id && <span className="icono-turno" title="Turno">👉</span>}
      </div>
      <div className={`fila-cartas ${recogiendo ? "recogiendo" : ""}`}>
        {slots.map((slot, i) => {
          if (slot && slot.jugada) return <div key={`hueco-${j.id}-${i}`} className="carta-hueco" />;
          const carta = slot;
          return (
            <div key={carta?.id || `${j.id}-${i}`} className="carta-repartida" style={{ animationDelay: `${i * 0.08}s` }}>
              <PlayingCard carta={carta} tapada={!carta} jugable={esYo && esMiTurno && !cantoPendiente && !!carta} onClick={() => carta && jugarCarta(carta.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CartaCentral({ cj, jugadores }) {
  if (!cj) return <div className="carta-hueco" />;
  const nombreJ = jugadores.find((j) => j.id === cj.jugadorId)?.nombre || "";
  return (
    <div className="carta-jugada-anim">
      <PlayingCard carta={cj.carta} />
      <div className="etiqueta-jugada">{nombreJ}</div>
    </div>
  );
}

// Mazo + muestra, agrandados y centrados entre los dos jugadores/equipos.
function MuestraCentral({ muestra }) {
  if (!muestra) return null;
  return (
    <div className="muestra-central">
      <div className="mazo-tapado-grande" />
      <PlayingCard carta={muestra} className="carta-muestra-grande" />
    </div>
  );
}

function CentroMesa({ estado, jugadores }) {
  return (
    <div className="centro-mesa">
      <MuestraCentral muestra={estado.muestra} />
      <div className="cartas-en-mesa">
        {estado.cartasJugadas.map((cj, i) => (
          <div key={`${cj.carta.id}-${i}`} className="carta-jugada-anim">
            <PlayingCard carta={cj.carta} />
            <div className="etiqueta-jugada">{jugadores.find((j) => j.id === cj.jugadorId)?.nombre || ""}</div>
          </div>
        ))}
      </div>
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
  const esMiTurno = !esEspectador && estado.turno === userId && !estado.bazaPendiente;
  const miEquipo = jugadores.find((j) => j.id === userId)?.equipo || "A";
  const cantoPendiente = estado.estadoCanto && !estado.estadoCanto.respondido;
  const puedoResponderCanto = !esEspectador && cantoPendiente && estado.estadoCanto.equipoQueResponde === miEquipo;
  const nombreEquipoA = esUno ? (jugadores.find((j) => j.equipo === "A")?.nombre || "Equipo A") : "Equipo A";
  const nombreEquipoB = esUno ? (jugadores.find((j) => j.equipo === "B")?.nombre || "Equipo B") : "Equipo B";
  const puedoCantarTruco = !esEspectador && !cantoPendiente && !estado.bazaPendiente && estado.trucoNivel < 3 && estado.trucoPalabra === miEquipo;
  const puedoIrseAlMazo = !esEspectador && !cantoPendiente && !estado.bazaPendiente && !estado.manoTerminada;

  function jugarCarta(cartaId) { if (!esEspectador) socket.emit("juego:jugar-carta", { lobbyId: lobby.id, cartaId }); }
  function cantarTruco() { socket.emit("juego:cantar-truco", { lobbyId: lobby.id }); }
  function responderTruco(q) { socket.emit("juego:responder-truco", { lobbyId: lobby.id, quiero: q }); }
  function cantarEnvido(tipo) { socket.emit("juego:cantar-envido", { lobbyId: lobby.id, tipo }); }
  function responderEnvido(q) { socket.emit("juego:responder-envido", { lobbyId: lobby.id, quiero: q }); }
  function cantarFlor(tipo) { socket.emit("juego:cantar-flor", { lobbyId: lobby.id, tipo }); }
  function responderFlor(q) { socket.emit("juego:responder-flor", { lobbyId: lobby.id, quiero: q }); }
  function irseAlMazo() { socket.emit("juego:irse-al-mazo", { lobbyId: lobby.id }); }
  function escalarTruco() { responderTruco(true); cantarTruco(); }
  function escalarEnvido(tipo) { responderEnvido(true); cantarEnvido(tipo); }

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
    const cjRival = estado.cartasJugadas.find((cj) => cj.jugadorId === rival?.id);
    const cjMia = estado.cartasJugadas.find((cj) => cj.jugadorId === yo?.id);
    contenidoMesa = (
      <div className="mesa-1v1">
        {rival && <Asiento j={rival} {...asientoProps} />}
        <div className="centro-mesa-vertical">
          <MuestraCentral muestra={estado.muestra} />
          <CartaCentral cj={cjRival} jugadores={jugadores} />
          <CartaCentral cj={cjMia} jugadores={jugadores} />
        </div>
        {yo && <Asiento j={yo} {...asientoProps} />}
      </div>
    );
  } else if (esUno && esEspectador) {
    const [j0, j1] = jugadores;
    const cj0 = estado.cartasJugadas.find((cj) => cj.jugadorId === j0?.id);
    const cj1 = estado.cartasJugadas.find((cj) => cj.jugadorId === j1?.id);
    contenidoMesa = (
      <div className="mesa-1v1">
        <Asiento j={j1} {...asientoProps} />
        <div className="centro-mesa-vertical">
          <MuestraCentral muestra={estado.muestra} />
          <CartaCentral cj={cj1} jugadores={jugadores} />
          <CartaCentral cj={cj0} jugadores={jugadores} />
        </div>
        <Asiento j={j0} {...asientoProps} />
      </div>
    );
  } else {
    // Mi equipo siempre abajo, el rival siempre arriba (usa !== para nunca dejar
    // una fila vacía por comparaciones con un equipo indefinido).
    const equipoAbajo = esEspectador ? "A" : miEquipo;
    contenidoMesa = (
      <div className="mesa-equipos">
        <div className="fila-equipo">
          {jugadores.filter((j) => j.equipo !== equipoAbajo).map((j) => <Asiento key={j.id} j={j} {...asientoProps} />)}
        </div>
        <CentroMesa estado={estado} jugadores={jugadores} />
        <div className="fila-equipo">
          {jugadores.filter((j) => j.equipo === equipoAbajo).map((j) => <Asiento key={j.id} j={j} {...asientoProps} />)}
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
        {(estado.historialManos || []).length > 0 && (
          <> · <button className="link-historial" onClick={() => setMostrarHistorial((v) => !v)}>
            {mostrarHistorial ? "ocultar" : "ver"} historial de manos
          </button></>
        )}
      </p>
      {mostrarHistorial && (
        <div className="panel historial-manos">
          {(estado.historialManos || []).slice().reverse().map((h) => (
            <div key={h.numero} className="fila-historial">
              {esUno ? (h.ganador === "A" ? nombreEquipoA : nombreEquipoB) : `Equipo ${h.ganador}`} ganó la mano +{h.puntos} puntos
              {h.detalle?.length > 0 && ` (${h.detalle.map((d) => `+${d.puntos} de ${d.motivo}`).join(" y ")})`}
            </div>
          ))}
        </div>
      )}

      {!esEspectador && estado.tengoFlor && <div className="banner-flor">🌸 ¡Tenés Flor! Podés cantarla antes de la primera baza.</div>}

      <div className="mesa">
        {contenidoMesa}
      </div>

      {!esEspectador && (cantoPendiente ? (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Canto: <b>{estado.estadoCanto.nivel}</b> ({estado.estadoCanto.tipo})</p>
          {puedoResponderCanto ? (
            <div className="acciones-canto">
              <button className="btn" onClick={() => responder(true)}>Quiero</button>
              <button className="btn btn-secundario" onClick={() => responder(false)}>No quiero</button>
              {estado.estadoCanto.tipo === "truco" && estado.trucoNivel < 3 && (
                <button className="btn" onClick={escalarTruco}>{NIVEL_TEXTO[SIGUIENTE_NIVEL[estado.trucoNivel]]}</button>
              )}
              {estado.estadoCanto.tipo === "envido" && estado.estadoCanto.nivel !== "falta-envido" && (
                <button className="btn" onClick={() => escalarEnvido(estado.estadoCanto.nivel === "envido" ? "real-envido" : "falta-envido")}>
                  {estado.estadoCanto.nivel === "envido" ? "Real Envido" : "Falta Envido"}
                </button>
              )}
            </div>
          ) : (
            <p className="texto-suave">Esperando respuesta del rival...</p>
          )}
        </div>
      ) : (
        <div className="acciones-canto">
          {puedoCantarTruco && <button className="btn" onClick={cantarTruco}>{NIVEL_TEXTO[SIGUIENTE_NIVEL[estado.trucoNivel]]}</button>}
          {estado.envidoDisponible && <button className="btn" onClick={() => cantarEnvido("envido")}>Envido</button>}
          {estado.tengoFlor && <button className="btn" onClick={() => cantarFlor("flor")}>🌸 Flor</button>}
          {estado.tengoFlor && <button className="btn" onClick={() => cantarFlor("contraflor")}>Contraflor</button>}
          {puedoIrseAlMazo && <button className="btn btn-secundario" onClick={irseAlMazo}>Irse al mazo</button>}
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