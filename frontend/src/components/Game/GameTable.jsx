import { useEffect, useRef, useState } from "react";
import { socket } from "../../lib/socket";
import PlayingCard from "./PlayingCard";
import TurnTimer from "./TurnTimer";

const NIVEL_TEXTO = { truco: "Truco", retruco: "Retruco", vale4: "Vale 4" };
const SIGUIENTE_NIVEL = { 0: "truco", 1: "retruco", 2: "vale4" };
const ETIQUETA_ENVIDO = { envido: "Envido", "envido-envido": "5 Envido", "real-envido": "Real Envido", "falta-envido": "Falta Envido" };

function distribuirAsientos(jugadores, userId, modo, esEspectador) {
  const equipos = { A: [], B: [] };
  jugadores.forEach((j) => equipos[j.equipo]?.push(j));
  const yo = esEspectador ? null : jugadores.find((j) => j.id === userId);
  const miEquipo = yo ? yo.equipo : "A";
  const mios = equipos[miEquipo].slice();
  const rivales = equipos[miEquipo === "A" ? "B" : "A"].slice();
  const yoIdx = yo ? mios.findIndex((j) => j.id === yo.id) : 0;
  const me = mios.splice(Math.max(0, yoIdx), 1)[0];
  const comp = mios;
  if (modo === "2v2") {
    return { top: [comp[0], rivales[0]], bottom: [rivales[1], me] };
  }
  return { top: [comp[0], rivales[0], comp[1]], bottom: [rivales[1], me, rivales[2]] };
}

function Asiento({ j, estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos, bloqueado, cantoPunto, turnoKey, mazoAnim }) {
  const esYo = !esEspectador && j.id === userId;
  const slots = estado.manos[j.id] || [];
  const esTurnoJugar = !estado.bazaPendiente && !estado.manoTerminada && !estado.revelacionEnvido && !cantoPendiente && estado.turno === j.id;
  const alMazo = mazoAnim && mazoAnim.equipo === j.equipo;
  return (
    <div className={`asiento ${esYo ? "asiento-yo" : ""}`}>
      {cantoPunto && (
        <div className={`burbuja-envido burbuja-${j.equipo?.toLowerCase() || "a"} ${cantoPunto === "Son buenas" ? "burbuja-buenas" : ""}`}>
          {cantoPunto}
        </div>
      )}
      <div className="nombre-jugador">
        {esModoEquipos && <span className={`letra-equipo letra-${j.equipo.toLowerCase()}`}>{j.equipo}</span>}
        <span className={(!estado.bazaPendiente && estado.turno === j.id) ? "nombre-en-turno" : ""}>{j.nombre}</span>
        {lobby.jugadores[estado.manoIndex]?.id === j.id && <span className="icono-mano" title="Es mano">M</span>}
      </div>
      {esTurnoJugar && (
        <div className="barra-turno" title="Tiempo para jugar">
          <div key={turnoKey} className="barra-turno-fill" />
        </div>
      )}
      <div className={`fila-cartas ${recogiendo ? "recogiendo" : ""} ${alMazo ? "al-mazo" : ""}`}>
        {slots.map((slot, i) => {
          if (slot && slot.jugada) return null;
          const carta = slot;
          return (
            <div key={carta?.id || `${j.id}-${i}`} className="carta-repartida" style={{ animationDelay: `${i * 0.13}s` }}>
              <PlayingCard carta={carta} tapada={!carta} jugable={esYo && esMiTurno && !cantoPendiente && !bloqueado && !!carta} onClick={() => carta && jugarCarta(carta.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CartaCentral({ cj, jugadores, esParda }) {
  if (!cj) return <div className="carta-hueco" />;
  const nombreJ = jugadores.find((p) => p.id === cj.jugadorId)?.nombre || "";
  const esGanadora = !esParda && cj.esGanadora;
  return (
    <div className="carta-jugada-anim">
      <PlayingCard carta={cj.carta} className={esGanadora || esParda ? 'carta-ganadora-borde' : ''} />
      <div className="etiqueta-jugada">{nombreJ}</div>
    </div>
  );
}

function MuestraCentral({ muestra }) {
  if (!muestra) return null;
  return (
    <div className="muestra-central">
      <div className="mazo-tapado-grande" />
      <PlayingCard carta={muestra} className="carta-muestra-grande" />
    </div>
  );
}

function CartaFrente({ cj }) {
  if (!cj) return <div className="carta-hueco carta-frente" />;
  return (
    <div className="carta-frente carta-jugada-anim">
      <PlayingCard carta={cj.carta} />
    </div>
  );
}

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
  const esParda = baza.equipoGanador === "parda";
  if (esParda) etiqueta = "Parda";
  else if (esUno) etiqueta = jugadores.find((j) => j.id === baza.ganadorId)?.nombre || "";
  else etiqueta = `Equipo ${baza.equipoGanador}`;
  return (
    <div className="baza-item">
      <div className="baza-pila" style={{ height: `${alto}px`, width: `${ancho}px` }}>
        {jugadas.map((jg, i) => {
          const esGanadora = !esParda && jg.jugadorId === baza.ganadorId;
          const esPardaGanadora = esParda;
          return (
            <div
              key={jg.carta.id}
              className={`baza-carta ${esGanadora || esPardaGanadora ? "ganadora" : ""}`}
              style={{ left: `${i * offX}px`, top: `${i * offY}px`, zIndex: i }}
            >
              <PlayingCard carta={jg.carta} className={`carta-mini ${esGanadora || esPardaGanadora ? 'carta-ganadora-borde' : ''}`} />
            </div>
          );
        })}
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

function MenuEnvido({ disabled, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);
  const opciones = ["envido", "envido-envido", "real-envido", "falta-envido"];
  return (
    <div className="menu-envido" ref={ref}>
      <button className="btn btn-general btn-envido-flecha" disabled={disabled} onClick={() => setAbierto((v) => !v)}>
        Envido ▾
      </button>
      {abierto && !disabled && (
        <div className="menu-envido-lista">
          {opciones.map((t) => (
            <button key={t} className="menu-envido-item" onClick={() => { onElegir(t); setAbierto(false); }}>
              {ETIQUETA_ENVIDO[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GameTable({ lobby, userId, esEspectador = false, espectadoresCount = 0, estado: estadoProp, finPartida, onVolverMenu }) {
  const [estado, setEstado] = useState(estadoProp);
  const [recogiendo, setRecogiendo] = useState(false);
  const [cuentaMano, setCuentaMano] = useState(6);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [revelCount, setRevelCount] = useState(0);
  const [accion, setAccion] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [mazoAnim, setMazoAnim] = useState(null);
  const manoIndexRef = useRef(null);
  const cuentaRef = useRef(null);
  const revelIntRef = useRef(null);

  const accionSrc = estado?.accionReciente || null;
  useEffect(() => {
    if (!accionSrc) return;
    setAccion(accionSrc);
    const t = setTimeout(() => setAccion((a) => (a?.id === accionSrc.id ? null : a)), 3000);
    return () => clearTimeout(t);
  }, [accionSrc?.id]);

  useEffect(() => {
    if (!accionSrc || accionSrc.texto !== "Me voy al mazo") return;
    const equipo = lobby.jugadores.find((j) => j.id === accionSrc.jugadorId)?.equipo;
    setMazoAnim({ id: accionSrc.id, equipo });
  }, [accionSrc?.id]);

  const avisoSrc = estado?.avisoTop || null;
  useEffect(() => {
    if (!avisoSrc) return;
    setAviso(avisoSrc);
    const t = setTimeout(() => setAviso((a) => (a?.id === avisoSrc.id ? null : a)), 3000);
    return () => clearTimeout(t);
  }, [avisoSrc?.id]);

  const revel = estado?.revelacionEnvido || null;
  useEffect(() => {
    clearInterval(revelIntRef.current);
    if (!revel) { setRevelCount(0); return; }
    const total = (revel.orden || []).length;
    setRevelCount(0);
    let i = 0;
    const arranque = setTimeout(() => {
      i = 1;
      setRevelCount(1);
      revelIntRef.current = setInterval(() => {
        i += 1;
        setRevelCount(i);
        if (i >= total) clearInterval(revelIntRef.current);
      }, 2000);
    }, 1800);
    return () => { clearTimeout(arranque); clearInterval(revelIntRef.current); };
  }, [revel?.id]);

  useEffect(() => {
    if (!estadoProp) return;
    if (manoIndexRef.current !== null && manoIndexRef.current !== estadoProp.manoIndex) {
      manoIndexRef.current = estadoProp.manoIndex;
      setRecogiendo(true);
      const t = setTimeout(() => {
        setRecogiendo(false);
        setMazoAnim(null);
        setEstado(estadoProp);
      }, 480);
      return () => clearTimeout(t);
    }
    manoIndexRef.current = estadoProp.manoIndex;
    setEstado(estadoProp);
  }, [estadoProp]);

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

  function burbujaDe(jugadorId) {
    return cantoDeEnvido(jugadorId) || (accion && accion.jugadorId === jugadorId ? accion.texto : null);
  }

  const miEquipo = jugadores.find((j) => j.id === userId)?.equipo || "A";
  const cantoPendiente = estado.estadoCanto && !estado.estadoCanto.respondido;
  const puedoResponderCanto = !esEspectador && cantoPendiente && estado.estadoCanto.equipoQueResponde === miEquipo
    && (esUno || estado.estadoCanto.tipo !== "truco" || !estado.trucoRespondeId || estado.trucoRespondeId === userId);
  const nombreEquipoA = esUno ? (jugadores.find((j) => j.equipo === "A")?.nombre || "Equipo A") : "Equipo A";
  const nombreEquipoB = esUno ? (jugadores.find((j) => j.equipo === "B")?.nombre || "Equipo B") : "Equipo B";
  const nombreEquipo = (eq) => (eq === "A" ? nombreEquipoA : eq === "B" ? nombreEquipoB : eq);

  // En equipos: cantar truco requiere tener el turno; revirar requiere haber respondido "quiero" justo ahora
  const puedoCantarTruco = !esEspectador && !cantoPendiente && !enRevelacion && !estado.bazaPendiente && !estado.manoTerminada
    && estado.trucoNivel < 3 && estado.trucoPalabra === miEquipo
    && (esUno || estado.turno === userId || (estado.trucoCantanteId === userId && estado.trucoPuedeEscalarAhora));

  // "Irse al mazo" solo si es tu turno y no hay otras condiciones que lo impidan
  const puedoIrseAlMazo = !esEspectador && !cantoPendiente && !enRevelacion && !estado.bazaPendiente && !estado.manoTerminada && esMiTurno;

  // "Envido" solo si está disponible y es tu turno
  const envidoDisponible = !esEspectador && estado.envidoDisponible && esMiTurno;

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

  const turnoKey = `${estado.turno}-${estado.manoIndex}-${estado.bazas.length}-${estado.cartasJugadas.length}`;
  const asientoProps = { estado, userId, esEspectador, esMiTurno, cantoPendiente, jugarCarta, lobby, recogiendo, esModoEquipos: !esUno, bloqueado: enRevelacion, turnoKey, mazoAnim };
  let contenidoMesa;

  // --- CARTAS EN MESA CON RESALTADO DE PARDA ---
  const renderCartasEnMesa = () => {
    const cartasJugadas = estado.cartasJugadas || [];
    const bazas = estado.bazas || [];
    
    // Si hay cartas jugadas actualmente (baza en curso)
    if (cartasJugadas.length > 0) {
      // Determinar si la baza ya está resuelta (última baza guardada y no hay cartas jugadas actuales en juego)
      const ultimaBaza = bazas.length > 0 ? bazas[bazas.length - 1] : null;
      const esParda = ultimaBaza && ultimaBaza.equipoGanador === "parda" && cartasJugadas.length === 0;
      
      return (
        <div className="cartas-en-mesa">
          {cartasJugadas.map((j, idx) => {
            const esGanadora = ultimaBaza && ultimaBaza.ganadorId === j.jugadorId && !esParda;
            return (
              <div key={idx} className="carta-jugada-anim">
                <PlayingCard 
                  carta={j.carta} 
                  className={esGanadora ? 'carta-ganadora-borde' : ''}
                />
                <div className="etiqueta-jugada">
                  {jugadores.find((p) => p.id === j.jugadorId)?.nombre || ""}
                </div>
              </div>
            );
          })}
          {esParda && <div className="banner-parda">🟡 ¡PARDA!</div>}
        </div>
      );
    }
    
    // Si no hay cartas jugadas, mostrar la última baza si existe
    if (bazas.length > 0) {
      const ultimaBaza = bazas[bazas.length - 1];
      const esParda = ultimaBaza.equipoGanador === "parda";
      return (
        <div className="cartas-en-mesa">
          {ultimaBaza.jugadas.map((j, idx) => {
            const esGanadora = !esParda && ultimaBaza.ganadorId === j.jugadorId;
            const esPardaGanadora = esParda;
            return (
              <div key={idx} className="carta-jugada-anim">
                <PlayingCard 
                  carta={j.carta} 
                  className={esGanadora || esPardaGanadora ? 'carta-ganadora-borde' : ''}
                />
                <div className="etiqueta-jugada">
                  {jugadores.find((p) => p.id === j.jugadorId)?.nombre || ""}
                </div>
              </div>
            );
          })}
          {esParda && <div className="banner-parda">🟡 ¡PARDA!</div>}
        </div>
      );
    }
    
    return null;
  };

  // --- RENDER DE LA MESA ---
  if (esUno && !esEspectador) {
    const rival = jugadores.find((j) => j.id !== userId);
    const yo = jugadores.find((j) => j.id === userId);
    contenidoMesa = (
      <div className="mesa-1v1">
        {rival && <Asiento j={rival} {...asientoProps} cantoPunto={burbujaDe(rival.id)} />}
        <div className="centro-mesa-vertical">
          {renderCartasEnMesa()}
          <MuestraCentral muestra={estado.muestra} />
        </div>
        {yo && <Asiento j={yo} {...asientoProps} cantoPunto={burbujaDe(yo.id)} />}
      </div>
    );
  } else if (esUno && esEspectador) {
    const [j0, j1] = jugadores;
    contenidoMesa = (
      <div className="mesa-1v1">
        <Asiento j={j1} {...asientoProps} cantoPunto={burbujaDe(j1?.id)} />
        <div className="centro-mesa-vertical">
          {renderCartasEnMesa()}
          <MuestraCentral muestra={estado.muestra} />
        </div>
        <Asiento j={j0} {...asientoProps} cantoPunto={burbujaDe(j0?.id)} />
      </div>
    );
  } else {
    const { top, bottom } = distribuirAsientos(jugadores, userId, lobby.modo, esEspectador);
    const cartaDe = (id) => estado.cartasJugadas.find((cj) => cj.jugadorId === id);
    contenidoMesa = (
      <div className={`mesa-matriz matriz-${lobby.modo}`}>
        <div className="fila-jugadores">
          {top.map((j) => <Asiento key={j.id} j={j} {...asientoProps} cantoPunto={burbujaDe(j.id)} />)}
        </div>
        <div className="fila-frente">
          {top.map((j) => <CartaFrente key={j.id} cj={cartaDe(j.id)} />)}
        </div>
        <div className="franja-muestra"><MuestraCentral muestra={estado.muestra} /></div>
        <div className="fila-frente">
          {bottom.map((j) => <CartaFrente key={j.id} cj={cartaDe(j.id)} />)}
        </div>
        <div className="fila-jugadores">
          {bottom.map((j) => <Asiento key={j.id} j={j} {...asientoProps} cantoPunto={burbujaDe(j.id)} />)}
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
        <TurnTimer
          activo={(esMiTurno && !cantoPendiente) || (puedoResponderCanto && !enRevelacion && !estado.manoTerminada)}
          segundos={puedoResponderCanto ? 10 : 20}
          resetKey={puedoResponderCanto ? `canto-${estado.estadoCanto?.nivel}-${estado.turno}` : estado.turno}
        />
        <span className="marcador">{nombreEquipoB}: {estado.puntos.B} pts</span>
      </div>
      <p className="texto-suave" style={{ textAlign: "center", margin: "0 0 0.5rem" }}>
        Partida a {lobby.puntajeLimite || 30} tantos
        {espectadoresCount > 0 && <> · 👀 {espectadoresCount}</>}
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

      <div className="mensajes-arriba">
        {aviso && <div className="banner-flor">{aviso.texto}</div>}
        {!esEspectador && estado.tengoFlor && !estado.florInicial && !estado.florDeclarar && !estado.florOpcion && (
          <div className="banner-flor">🌸 ¡Tenés Flor! Cantala cuando sea tu turno.</div>
        )}
        {enRevelacion && (
          <div className="banner-envido">
            {revelDone
              ? `${nombreEquipo(estado.revelacionEnvido.ganador)} ganó el envido (+${estado.revelacionEnvido.puntos})`
              : "🗣️ Cantando los tantos…"}
          </div>
        )}
        {!enRevelacion && estado.manoTerminada && (
          <div className="banner-envido">
            Ganó la mano {esUno ? (estado.ganadorMano === "A" ? nombreEquipoA : nombreEquipoB) : `el equipo ${estado.ganadorMano}`} — siguiente mano en {cuentaMano}s
          </div>
        )}
      </div>

      <div className="mesa-y-controles">
        <div className="controles-izquierda">
          {!esEspectador && !enRevelacion && !estado.manoTerminada && cantoPendiente && puedoResponderCanto && (
            <>
              <button className="btn" onClick={() => responder(true)}>Quiero</button>
              <button className="btn btn-secundario" onClick={() => responder(false)}>No quiero</button>
              {estado.estadoCanto.tipo === "truco" && estado.trucoNivel < 3 && (
                <button className="btn" onClick={escalarTruco}>{NIVEL_TEXTO[SIGUIENTE_NIVEL[estado.trucoNivel]]}</button>
              )}
              {estado.estadoCanto.tipo === "envido" && (estado.estadoCanto.siguientes || []).map((t) => (
                <button key={t} className="btn" onClick={() => cantarEnvido(t)}>{ETIQUETA_ENVIDO[t]}</button>
              ))}
            </>
          )}
          {!esEspectador && !cantoPendiente && (
            <>
              <button className="btn btn-general" disabled={!puedoCantarTruco} onClick={cantarTruco}>
                {NIVEL_TEXTO[SIGUIENTE_NIVEL[estado.trucoNivel]] || "Truco"}
              </button>
              <MenuEnvido disabled={!envidoDisponible} onElegir={cantarEnvido} />
              {(estado.florInicial || estado.florDeclarar) && <button className="btn" onClick={() => cantarFlor("flor")}>🌸 Flor</button>}
              {estado.florOpcion && <button className="btn" onClick={() => cantarFlor("contraflor-al-resto")}>Contra flor al resto</button>}
              {estado.florOpcion && <button className="btn btn-secundario" onClick={() => cantarFlor("con-flor-quiero")}>Con flor, quiero</button>}
              <button className="btn btn-general" disabled={!puedoIrseAlMazo} onClick={irseAlMazo}>Irse al mazo</button>
            </>
          )}
        </div>
        <div className="mesa-wrap">
          <div className="mesa">
            {contenidoMesa}
          </div>
          <HistorialBazas estado={estado} jugadores={jugadores} esUno={esUno} />
        </div>
      </div>
    </div>
  );
}