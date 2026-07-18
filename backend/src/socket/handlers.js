import { LobbyManager } from "../game/LobbyManager.js";
import { TurnTimer, TIEMPOS } from "../game/Timer.js";
import { guardarHistorial } from "../lib/appwrite.js";

const lobbyManager = new LobbyManager();
const timers = new Map(); // lobbyId -> TurnTimer
const sigManoTimers = new Map(); // lobbyId -> setTimeout handle
const bazaTimers = new Map(); // lobbyId -> setTimeout handle (delay antes de recoger la baza)
const revelTimers = new Map(); // lobbyId -> setTimeout handle (fin de la revelación de envido)
const conexiones = new Map(); // userId -> socket.id actual

const DELAY_RESOLVER_BAZA = 2000; // ms que quedan las cartas jugadas visibles en el centro de la mesa antes de recoger la baza
const DELAY_CANTO_ENVIDO = 2000; // ms entre cada "canto de tantos" sobre la cabeza de cada jugador

function emitirA(io, userId, evento, payload) {
  const sid = conexiones.get(userId);
  if (sid) io.to(sid).emit(evento, payload);
}

function programarSiguienteMano(io, lobby) {
  if (sigManoTimers.has(lobby.id)) return;
  const handle = setTimeout(() => {
    sigManoTimers.delete(lobby.id);
    try {
      if (!lobby.engine) return; // la mesa pudo limpiarse mientras esperaba
      lobby.engine.siguienteMano();
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
    } catch (e) {
      console.error(`Error en siguienteMano de mesa ${lobby.id}:`, e);
    }
  }, 6000);
  sigManoTimers.set(lobby.id, handle);
}

// Cuando ya se jugaron todas las cartas de la baza, primero se emite el estado
// (así todos ven las cartas servidas en el centro de la mesa) y recién después,
// con un pequeño delay, se resuelve la baza (se calcula ganador y se recogen).
function programarResolucionBaza(io, lobby) {
  if (bazaTimers.has(lobby.id)) return;
  const handle = setTimeout(() => {
    bazaTimers.delete(lobby.id);
    try {
      if (!lobby.engine) return;
      lobby.engine.resolverBazaPendienteSiCorresponde();
      emitirEstado(io, lobby);
      if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
    } catch (e) {
      console.error(`Error al resolver baza de mesa ${lobby.id}:`, e);
    }
  }, DELAY_RESOLVER_BAZA);
  bazaTimers.set(lobby.id, handle);
}

// Tras un "quiero" de envido se entra en FASE_ENVIDO: se van cantando los tantos
// (una burbuja cada DELAY_CANTO_ENVIDO ms en el cliente) y el juego queda pausado
// hasta que se cierra la revelación y se retoma el turno normal.
function programarFinRevelacionEnvido(io, lobby) {
  if (revelTimers.has(lobby.id)) return;
  const cantidad = lobby.engine.revelacionEnvido?.orden?.length || 1;
  const dur = cantidad * DELAY_CANTO_ENVIDO + 1200;
  const handle = setTimeout(() => {
    revelTimers.delete(lobby.id);
    try {
      if (!lobby.engine) return;
      lobby.engine.finalizarRevelacionEnvido();
      emitirEstado(io, lobby);
      if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
    } catch (e) {
      console.error(`Error al cerrar revelación de envido de mesa ${lobby.id}:`, e);
    }
  }, dur);
  revelTimers.set(lobby.id, handle);
}

function emitirEstado(io, lobby) {
  for (const j of lobby.jugadores) {
    emitirA(io, j.id, "estado", lobby.engine.estadoPublico(j.id));
  }
  for (const e of lobby.espectadores) {
    emitirA(io, e.id, "estado", lobby.engine.estadoPublico(e.id, true));
  }
  const ganador = lobby.engine.finDePartida();
  if (ganador) {
    io.to(lobby.id).emit("fin-partida", { ganador, puntos: lobby.engine.puntos });
    timers.get(lobby.id)?.cancelar();
    guardarHistorial(lobby, ganador).catch((e) => console.error("No se pudo guardar historial:", e.message));
    io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    // Si nadie sale explícitamente (cierran la pestaña), igual liberamos la mesa a los 5 min.
    setTimeout(() => {
      lobbyManager.eliminar(lobby.id);
      io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    }, 5 * 60 * 1000);
  } else if (lobby.engine.manoTerminada) {
    programarSiguienteMano(io, lobby);
  }
}

function armarTimerJugada(io, lobby) {
  timers.get(lobby.id)?.cancelar();
  const timer = new TurnTimer(TIEMPOS.jugarCarta, () => {
    try {
      const engine = lobby.engine;
      if (!engine) return;
      // No corresponde jugar/responder por timeout si la mano terminó, hay una baza
      // pendiente de resolver o estamos en la revelación del envido.
      if (engine.manoTerminada || engine.bazaPendiente || engine.revelacionEnvido) return;
      const ec = engine.estadoCanto;
      if (ec && !ec.respondido) {
        // Responde automáticamente "no quiero" en nombre del equipo que debe responder
        // (no necesariamente el del turno de la carta).
        const respondedor = lobby.jugadores.find((j) => engine.equipoDe(j.id) === ec.equipoQueResponde)?.id
          || engine.jugadorActual()?.id;
        if (!respondedor) return;
        if (ec.tipo === "truco") engine.responderTruco(respondedor, false);
        else if (ec.tipo === "flor") engine.responderFlor(respondedor, false);
        else engine.responderEnvido(respondedor, false);
      } else {
        const actual = engine.jugadorActual();
        if (!actual) return;
        engine.jugarCartaAleatoria(actual.id);
      }
      emitirEstado(io, lobby);
      if (engine.revelacionEnvido) {
        programarFinRevelacionEnvido(io, lobby);
      } else if (engine.bazaPendiente) {
        programarResolucionBaza(io, lobby);
      } else if (!engine.manoTerminada) {
        armarTimerJugada(io, lobby);
      }
    } catch (e) {
      console.error(`Error en timer de jugada de mesa ${lobby.id}:`, e);
    }
  });
  timer.iniciar();
  timers.set(lobby.id, timer);
}

export function registrarHandlers(io, socket) {
  const userId = socket.handshake.auth?.userId || socket.id;
  socket.data.userId = userId;
  conexiones.set(userId, socket.id);

  socket.on("lobby:listar", (cb) => cb(lobbyManager.listarPublicos()));

  // Info de una mesa puntual por su ID (para entrar directo por urutrick.vercel.app/{id})
  socket.on("lobby:info", (lobbyId, cb) => {
    const lobby = lobbyManager.get(lobbyId);
    if (!lobby) return cb?.({ ok: false, error: "Mesa no encontrada" });
    cb?.({
      ok: true,
      id: lobby.id,
      nombre: lobby.nombre,
      modo: lobby.modo,
      jugadores: lobby.jugadores.length,
      iniciado: lobby.iniciado,
      tienePassword: !!lobby.password,
      soyJugador: lobby.jugadores.some((j) => j.id === userId),
    });
  });

  socket.on("lobby:crear", (data, cb) => {
    try {
      const lobby = lobbyManager.crear({ ...data, creador: { id: userId, nombre: data.nombre_jugador } });
      socket.join(lobby.id);
      cb({ ok: true, lobby });
      io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on("lobby:unirse", ({ lobbyId, nombre, password }, cb) => {
    try {
      const lobby = lobbyManager.unirse(lobbyId, { id: userId, nombre }, password);
      socket.join(lobbyId);
      io.to(lobbyId).emit("lobby:jugadores", lobby.jugadores);
      cb({ ok: true, lobby });
      io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  // Espectar: no ocupa asiento, ve todas las cartas de todos los jugadores.
  socket.on("lobby:espectar", ({ lobbyId, nombre }, cb) => {
    try {
      const lobby = lobbyManager.espectar(lobbyId, { id: userId, nombre: nombre || "Espectador" });
      socket.join(lobbyId);
      cb?.({ ok: true, lobby, iniciado: lobby.iniciado });
      if (lobby.iniciado) emitirA(io, userId, "estado", lobby.engine.estadoPublico(userId, true));
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  // Reconexión tras refresh: el cliente guarda lobbyId en localStorage y reintenta esto al reconectar
  socket.on("lobby:reconectar", ({ lobbyId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      if (!lobby) return cb?.({ ok: false });
      const esJugador = lobby.jugadores.some((j) => j.id === userId);
      const esEspectador = lobby.espectadores.some((e) => e.id === userId);
      if (!esJugador && !esEspectador) return cb?.({ ok: false });
      socket.join(lobbyId);
      cb?.({ ok: true, lobby, iniciado: lobby.iniciado, esEspectador });
      if (lobby.iniciado) emitirA(io, userId, "estado", lobby.engine.estadoPublico(userId, esEspectador));
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("lobby:iniciar", (lobbyId, cb) => {
    try {
      const lobby = lobbyManager.iniciar(lobbyId);
      io.to(lobbyId).emit("juego:iniciado");
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb({ ok: true });
      io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on("juego:jugar-carta", ({ lobbyId, cartaId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.jugarCarta(userId, cartaId);
      emitirEstado(io, lobby);
      if (lobby.engine.bazaPendiente) {
        timers.get(lobby.id)?.cancelar();
        programarResolucionBaza(io, lobby);
      } else if (!lobby.engine.manoTerminada) {
        armarTimerJugada(io, lobby);
      }
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:cantar-truco", ({ lobbyId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.cantarTruco(userId);
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:responder-truco", ({ lobbyId, quiero }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.responderTruco(userId, quiero);
      emitirEstado(io, lobby);
      if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:cantar-envido", ({ lobbyId, tipo }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.cantarEnvido(userId, tipo);
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:responder-envido", ({ lobbyId, quiero }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.responderEnvido(userId, quiero);
      emitirEstado(io, lobby);
      if (lobby.engine.revelacionEnvido) {
        timers.get(lobby.id)?.cancelar();
        programarFinRevelacionEnvido(io, lobby);
      } else {
        armarTimerJugada(io, lobby);
      }
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:cantar-flor", ({ lobbyId, tipo }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.cantarFlor(userId, tipo);
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:responder-flor", ({ lobbyId, quiero }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.responderFlor(userId, quiero);
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:siguiente-mano", ({ lobbyId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.siguienteMano();
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:irse-al-mazo", ({ lobbyId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.irseAlMazo(userId);
      emitirEstado(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("lobby:salir", ({ lobbyId }) => {
    lobbyManager.salir(lobbyId, userId);
    io.emit("lobby:actualizado", lobbyManager.listarPublicos());
  });

  // OJO: en desconexión NO sacamos al jugador del lobby (permite reconectar tras refresh).
  // Solo se libera el asiento con el evento explícito "lobby:salir".
  socket.on("disconnect", () => {
    if (conexiones.get(userId) === socket.id) conexiones.delete(userId);
  });
}