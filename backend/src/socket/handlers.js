import { LobbyManager } from "../game/LobbyManager.js";
import { TurnTimer, TIEMPOS } from "../game/Timer.js";
import { guardarHistorial } from "../lib/appwrite.js";

const lobbyManager = new LobbyManager();
const timers = new Map(); // lobbyId -> TurnTimer
const conexiones = new Map(); // userId -> socket.id actual

function emitirA(io, userId, evento, payload) {
  const sid = conexiones.get(userId);
  if (sid) io.to(sid).emit(evento, payload);
}

function emitirEstado(io, lobby) {
  for (const j of lobby.jugadores) {
    emitirA(io, j.id, "estado", lobby.engine.estadoPublico(j.id));
  }
  const ganador = lobby.engine.finDePartida();
  if (ganador) {
    io.to(lobby.id).emit("fin-partida", { ganador, puntos: lobby.engine.puntos });
    timers.get(lobby.id)?.cancelar();
    guardarHistorial(lobby, ganador).catch((e) => console.error("No se pudo guardar historial:", e.message));
  }
}

function armarTimerJugada(io, lobby) {
  timers.get(lobby.id)?.cancelar();
  const timer = new TurnTimer(TIEMPOS.jugarCarta, () => {
    const jugadorId = lobby.engine.jugadorActual().id;
    if (lobby.engine.estadoCanto && !lobby.engine.estadoCanto.respondido) {
      const tipo = lobby.engine.estadoCanto.tipo;
      if (tipo === "truco") lobby.engine.responderTruco(jugadorId, false);
      else if (tipo === "flor") lobby.engine.responderFlor(jugadorId, false);
      else lobby.engine.responderEnvido(jugadorId, false);
    } else {
      lobby.engine.jugarCartaAleatoria(jugadorId);
    }
    emitirEstado(io, lobby);
    if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
  });
  timer.iniciar();
  timers.set(lobby.id, timer);
}

export function registrarHandlers(io, socket) {
  const userId = socket.handshake.auth?.userId || socket.id;
  socket.data.userId = userId;
  conexiones.set(userId, socket.id);

  socket.on("lobby:listar", (cb) => cb(lobbyManager.listarPublicos()));

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

  // Reconexión tras refresh: el cliente guarda lobbyId en localStorage y reintenta esto al reconectar
  socket.on("lobby:reconectar", ({ lobbyId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      if (!lobby || !lobby.jugadores.some((j) => j.id === userId)) return cb?.({ ok: false });
      socket.join(lobbyId);
      cb?.({ ok: true, lobby, iniciado: lobby.iniciado });
      if (lobby.iniciado) emitirA(io, userId, "estado", lobby.engine.estadoPublico(userId));
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("lobby:iniciar", (lobbyId, cb) => {
    try {
      const lobby = lobbyManager.iniciar(lobbyId);
      io.to(lobbyId).emit("juego:iniciado");
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb({ ok: true });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on("juego:jugar-carta", ({ lobbyId, cartaId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.jugarCarta(userId, cartaId);
      emitirEstado(io, lobby);
      if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
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
      armarTimerJugada(io, lobby);
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
