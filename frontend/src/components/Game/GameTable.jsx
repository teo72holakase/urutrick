import { useEffect, useRef, useState } from "react";
import { socket } from "../../lib/socket";
import PlayingCard from "./PlayingCard";
import TurnTimer from "./TurnTimer";

const NIVEL_TEXTO = { truco: "Truco", retruco: "Retruco", vale4: "Vale 4" };
const SIGUIENTE_NIVEL = { 0: "truco", 1: "retruco", 2: "vale4" };
const ETIQUETA_ENVIDO = { envido: "Envido", "real-envido": "Real Envido", "falta-envido": "Falta Envido" };
const nombreCanto = (nivel) => ETIQUETA_ENVIDO[nivel] || NIVEL_TEXTO[nivel] || (nivel || "").replace(/-/g, " ");

// Reparte a los jugadores en un damero alrededor de la mesa: 2v2 [AB / BA],
// 3v3 [ABA / BAB]. "Yo" quedo en la fila de abajo, mis compañeros en diagonal
// y los rivales intercalados. Para espectador se usa el equipo A como referencia.
function distribuirAsientos(jugadores, userId, modo, esEspectador) {
  const equipos = { A: [], B: [] };
  jugadores.forEach((j) => equipos[j.equipo]?.push(j));
  const yo = esEspectador ? null : jugadores.find((j) => j.id === userId);
  const miEquipo = yo ? yo.equipo : "A";
  const mios = equipos[miEquipo].slice();
  const rivales = equipos[miEquipo === "A" ? "B" : "A"].slice();
  const yoIdx = yo ? mios.findIndex((j) => j.id === yo.id) : 0;
  const me = mios.splice(Math.max(0, yoIdx), 1)[0]; // saco "yo"; quedan los compañeros
  const comp = mios;
  if (modo === "2v2") {
    return { top: [comp[0], rivales[0]], bottom: [rivales[1], me] };
  }
  return { top: [comp[0], rivales[0], comp[1]], bottom: [rivales[1], me, rivales[2]] };
}

function Asiento({ j, estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos, bloqueado, cantoPunto }) {
  const esYo = !esEspectador && j.id === userId;
  const slots = estado.manos[j.id] || [];
  return (
    <div className={`asiento ${esYo ? "asiento-yo" : ""}`}>
      {cantoPunto && (
        <div className={`burbuja-envido burbuja-${j.equipo?.toLowerCase() || "a"} ${cantoPunto === "Son buenas" ? "burbuja-buenas" : ""}`}>
          {cantoPunto}
        </div>
      )}
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
              <PlayingCard carta={carta} tapada={!carta} jugable={esYo && esMiTurno && !cantoPendiente && !bloqueado && !!carta} onClick={() => carta && jugarCarta(carta.id)} />
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

// Carta que jugo un jugador, ubicada justo enfrente de su asiento (modo equipos).
function CartaFrente({ cj }) {
  if (!cj) return <div className="carta-hueco carta-frente" />;
  return (
    <div className="carta-frente carta-jugada-anim">
      <PlayingCard carta={cj.carta} />
    </div>
  );
}

// Una baza ya jugada: todas las cartas apiladas con la ganadora encima de la(s)
// perdedora(s), y debajo el jugador (1v1) o el equipo (2v2/3v3) que la ganó.
function PilaBaza({ baza, jugadores, esUno }) {
  const jugadas = [...(baza.jugadas || [])].sort(
    (a, b) => (a.jugadorId === baza.ganadorId ? 1 : 0) - (b.jugadorId === baza.ganadorId ? 1 : 0)
  );
  const n = jugadas.length;
  const CARTA_W = 40, CARTA_H = 61.8;
  const offX = n > 1 ? Math.min(14, Math.floor(48 / (n - 1))) : 0;
  const offY = n > 1 ? Math.min(12, Math.floor(40 / (n - 1))) : 0;
  const ancho = CARTA_W + (n - 1) * offX;
  const alto = CARTA_H + (n - 1) * offY;
  let etiqueta;
  if (baza.equipoGanador === "parda") etiqueta = "Parda";
  else if (esUno) etiqueta = jugadores.find((j) => j.id === baza.ganadorId)?.nombre || "";
  else etiqueta = `Equipo ${baza.equipoGanador}`;
  return (
    <div className="baza-item">
      <div className="baza-pila" style={{ height: `${alto}px`, width: `${ancho}px` }}>
        {jugadas.map((jg, i) => (
          <div
            key={jg.carta.id}
            className={`baza-carta ${jg.jugadorId === baza.ganadorId ? "ganadora" : ""}`}
            style={{ left: `${i * offX}px`, top: `${i * offY}px`, zIndex: i }}
          >
            <PlayingCard carta={jg.carta} className="carta-mini" />
          </div>
        ))}
      </div>
      <div className="baza-ganador">{etiqueta}</div>
    </div>
  );
}

function HistorialBazas({ estado, jugadores, esUno }) {
  const bazas = estado.bazas || [];
  return (
    <div className="historial-bazas">
      <div className="historial-bazas-titulo">Bazas</div>
      {bazas.length === 0 && <div className="historial-bazas-vacio">—</div>}
      {bazas.map((b, i) => (
        <PilaBaza key={i} baza={b} jugadores={jugadores} esUno={esUno} />
      ))}
    </div>
  );
}

export default function GameTable({ lobby, userId, esEspectador = false, estado, finPartida, onVolverMenu }) {
  const [recogiendo, setRecogiendo] = useState(false);
  const [cuentaMano, setCuentaMano] = useState(6);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [revelCount, setRevelCount] = useState(0);
  const manoIndexRef = useRef(null);
  const cuentaRef = useRef(null);

  // Canto de tantos: cada jugador de la secuencia "habla" una burbuja cada 2s.
  const revel = estado?.revelacionEnvido || null;
  useEffect(() => {
    if (!revel) { setRevelCount(0); return; }
    const total = (revel.orden || []).length;
    let i = 1;
    setRevelCount(1);
    const int = setInterval(() => {
      i += 1;
      setRevelCount(i);
      if (i >= total) clearInterval(int);
    }, 2000);
    return () => clearInterval(int);
  }, [revel?.id]);

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
  const enRevelacion = !!estado.revelacionEnvido;
  const esMiTurno = !esEspectador && estado.turno === userId && !estado.bazaPendiente && !enRevelacion && !estado.manoTerminada;

  // Texto de la burbuja de tantos que corresponde a un jugador en este instante.
  // Aparecen en orden (revelCount) y cada una queda hasta que aparezca un puntaje
  // mayor posterior; "Son buenas" no revela número y se va apenas hay uno mayor.
  function cantoDeEnvido(jugadorId) {
    if (!enRevelacion) return null;
    const orden = estado.revelacionEnvido.orden || [];
    const idx = orden.findIndex((o) => o.jugadorId === jugadorId);
    if (idx === -1 || idx >= revelCount) return null;
    const pts = orden[idx].puntos == null ? -1 : orden[idx].puntos;
    for (let k = idx + 1; k < Math.min(revelCount, orden.length); k++) {
      const p = orden[k].puntos == null ? -1 : orden[k].puntos;
      if (p > pts) return null;
    }
    return orden[idx].texto;
  }
  const miEquipo = jugadores.find((j) => j.id === userId)?.equipo || "A";
  const cantoPendiente = estado.estadoCanto && !estado.estadoCanto.respondido;
  const puedoResponderCanto = !esEspectador && cantoPendiente && estado.estadoCanto.equipoQueResponde === miEquipo;
  const nombreEquipoA = esUno ? (jugadores.find((j) => j.equipo === "A")?.nombre || "Equipo A") : "Equipo A";
  const nombreEquipoB = esUno ? (jugadores.find((j) => j.equipo === "B")?.nombre || "Equipo B") : "Equipo B";
  const nombreEquipo = (eq) => (eq === "A" ? nombreEquipoA : eq === "B" ? nombreEquipoB : eq);
  const puedoCantarTruco = !esEspectador && !cantoPendiente && !estado.bazaPendiente && !estado.manoTerminada && estado.trucoNivel < 3 && estado.trucoPalabra === miEquipo;
  const puedoIrseAlMazo = !esEspectador && !cantoPendiente && !estado.bazaPendiente && !estado.manoTerminada;
  const revelDone = enRevelacion && revelCount >= ((estado.revelacionEnvido.orden || []).length);

  function jugarCarta(cartaId) { if (!esEspectador) socket.emit("juego:jugar-carta", { lobbyId: lobby.id, cartaId }); }
  function cantarTruco() { socket.emit("juego:cantar-truco", { lobbyId: lobby.id }); }
  function responderTruco(q) { socket.emit("juego:responder-truco", { lobbyId: lobby.id, quiero: q }); }
  function cantarEnvido(tipo) { socket.emit("juego:cantar-envido", { lobbyId: lobby.id, tipo }); }
  function responderEnvido(q) { socket.emit("juego:responder-envido", { lobbyId: lobby.id, quiero: q }); }
  function cantarFlor(tipo) { socket.emit("juego:cantar-flor", { lobbyId: lobby.id, tipo }); }
  function responderFlor(q) { socket.emit("juego:responder-flor", { lobbyId: lobby.id, quiero: q }); }
  function irseAlMazo() { socket.emit("juego:irse-al-mazo", { lobbyId: lobby.id }); }
  function escalarTruco() { responderTruco(true); cantarTruco(); }

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

  const asientoProps = { estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos: !esUno, bloqueado: enRevelacion };
  let contenidoMesa;
  if (esUno && !esEspectador) {
    const rival = jugadores.find((j) => j.id !== userId);
    const yo = jugadores.find((j) => j.id === userId);
    const cjRival = estado.cartasJugadas.find((cj) => cj.jugadorId === rival?.id);
    const cjMia = estado.cartasJugadas.find((cj) => cj.jugadorId === yo?.id);
    contenidoMesa = (
      <div className="mesa-1v1">
        {rival && <Asiento j={rival} {...asientoProps} cantoPunto={cantoDeEnvido(rival.id)} />}
        <div className="centro-mesa-vertical">
          <CartaCentral cj={cjRival} jugadores={jugadores} />
          <MuestraCentral muestra={estado.muestra} />
          <CartaCentral cj={cjMia} jugadores={jugadores} />
        </div>
        {yo && <Asiento j={yo} {...asientoProps} cantoPunto={cantoDeEnvido(yo.id)} />}
      </div>
    );
  } else if (esUno && esEspectador) {
    const [j0, j1] = jugadores;
    const cj0 = estado.cartasJugadas.find((cj) => cj.jugadorId === j0?.id);
    const cj1 = estado.cartasJugadas.find((cj) => cj.jugadorId === j1?.id);
    contenidoMesa = (
      <div className="mesa-1v1">
        <Asiento j={j1} {...asientoProps} cantoPunto={cantoDeEnvido(j1?.id)} />
        <div className="centro-mesa-vertical">
          <CartaCentral cj={cj1} jugadores={jugadores} />
          <MuestraCentral muestra={estado.muestra} />
          <CartaCentral cj={cj0} jugadores={jugadores} />
        </div>
        <Asiento j={j0} {...asientoProps} cantoPunto={cantoDeEnvido(j0?.id)} />
      </div>
    );
  } else {
    // Equipos alternados en damero: 2v2 [AB / BA], 3v3 [ABA / BAB]. Yo (o el
    // primer jugador del equipo A si soy espectador) quedo abajo, mis compañeros
    // en diagonal y los rivales intercalados. Cada carta jugada va enfrente.
    const { top, bottom } = distribuirAsientos(jugadores, userId, lobby.modo, esEspectador);
    const cartaDe = (id) => estado.cartasJugadas.find((cj) => cj.jugadorId === id);
    contenidoMesa = (
      <div className={`mesa-matriz matriz-${lobby.modo}`}>
        <div className="fila-jugadores">
          {top.map((j) => <Asiento key={j.id} j={j} {...asientoProps} cantoPunto={cantoDeEnvido(j.id)} />)}
        </div>
        <div className="fila-frente">
          {top.map((j) => <CartaFrente key={j.id} cj={cartaDe(j.id)} />)}
        </div>
        <div className="franja-muestra"><MuestraCentral muestra={estado.muestra} /></div>
        <div className="fila-frente">
          {bottom.map((j) => <CartaFrente key={j.id} cj={cartaDe(j.id)} />)}
        </div>
        <div className="fila-jugadores">
          {bottom.map((j) => <Asiento key={j.id} j={j} {...asientoProps} cantoPunto={cantoDeEnvido(j.id)} />)}
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
              <b>{esUno ? (h.ganador === "A" ? nombreEquipoA : nombreEquipoB) : `Equipo ${h.ganador}`} ganó la mano</b>
              {h.detalle?.length > 0 && (
                <span> — {h.detalle.map((d) => `+${d.puntos} ${nombreEquipo(d.equipo)} (${d.motivo})`).join(" · ")}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!esEspectador && estado.tengoFlor && <div className="banner-flor">🌸 ¡Tenés Flor! Podés cantarla antes de la primera baza.</div>}

      {enRevelacion && (
        <div className="banner-envido">
          {revelDone
            ? `${nombreEquipo(estado.revelacionEnvido.ganador)} ganó el envido (+${estado.revelacionEnvido.puntos})`
            : "🗣️ Cantando los tantos…"}
        </div>
      )}

      <div className="mesa-wrap">
        <div className="mesa">
          {contenidoMesa}
        </div>
        <HistorialBazas estado={estado} jugadores={jugadores} esUno={esUno} />
      </div>

      {!esEspectador && !enRevelacion && !estado.manoTerminada && (cantoPendiente ? (
        <div className="panel" style={{ marginTop: "1rem", textAlign: "center" }}>
          <p>Canto: <b>{nombreCanto(estado.estadoCanto.nivel)}</b> ({estado.estadoCanto.tipo})</p>
          {puedoResponderCanto ? (
            <div className="acciones-canto">
              <button className="btn" onClick={() => responder(true)}>Quiero</button>
              <button className="btn btn-secundario" onClick={() => responder(false)}>No quiero</button>
              {estado.estadoCanto.tipo === "truco" && estado.trucoNivel < 3 && (
                <button className="btn" onClick={escalarTruco}>{NIVEL_TEXTO[SIGUIENTE_NIVEL[estado.trucoNivel]]}</button>
              )}
              {estado.estadoCanto.tipo === "envido" && (estado.estadoCanto.siguientes || []).map((t) => (
                <button key={t} className="btn" onClick={() => cantarEnvido(t)}>{ETIQUETA_ENVIDO[t]}</button>
              ))}
            </div>
          ) : (
            <p className="texto-suave">Esperando respuesta del rival...</p>
          )}
        </div>
      ) : (
        <div className="acciones-canto">
          {puedoCantarTruco && <button className="btn" onClick={cantarTruco}>{NIVEL_TEXTO[SIGUIENTE_NIVEL[estado.trucoNivel]]}</button>}
          {estado.envidoDisponible && <button className="btn" onClick={() => cantarEnvido("envido")}>Envido</button>}
          {estado.envidoDisponible && <button className="btn" onClick={() => cantarEnvido("falta-envido")}>Falta Envido</button>}
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