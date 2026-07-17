import { LobbyManager } from "../game/LobbyManager.js";
import { TurnTimer, TIEMPOS } from "../game/Timer.js";

const lobbyManager = new LobbyManager();
const timers = new Map(); // lobbyId -> TurnTimer

function emitirEstado(io, lobby) {
  for (const j of lobby.jugadores) {
    io.to(j.id).emit("estado", lobby.engine.estadoPublico(j.id));
  }
  const ganador = lobby.engine.finDePartida();
  if (ganador) {
    io.to(lobby.id).emit("fin-partida", { ganador, puntos: lobby.engine.puntos });
    timers.get(lobby.id)?.cancelar();
  }
}

function armarTimerJugada(io, lobby) {
  timers.get(lobby.id)?.cancelar();
  const timer = new TurnTimer(TIEMPOS.jugarCarta, () => {
    const jugadorId = lobby.engine.jugadorActual().id;
    if (lobby.engine.estadoCanto && !lobby.engine.estadoCanto.respondido) {
      const tipo = lobby.engine.estadoCanto.tipo;
      if (tipo === "truco") lobby.engine.responderTruco(jugadorId, false);
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
  socket.on("lobby:listar", (cb) => cb(lobbyManager.listarPublicos()));

  socket.on("lobby:crear", (data, cb) => {
    try {
      const lobby = lobbyManager.crear({ ...data, creador: { id: socket.id, nombre: data.nombre_jugador } });
      socket.join(lobby.id);
      cb({ ok: true, lobby });
      io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on("lobby:unirse", ({ lobbyId, nombre, password }, cb) => {
    try {
      const lobby = lobbyManager.unirse(lobbyId, { id: socket.id, nombre }, password);
      socket.join(lobbyId);
      io.to(lobbyId).emit("lobby:jugadores", lobby.jugadores);
      cb({ ok: true, lobby });
      io.emit("lobby:actualizado", lobbyManager.listarPublicos());
    } catch (e) { cb({ ok: false, error: e.message }); }
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
      lobby.engine.jugarCarta(socket.id, cartaId);
      emitirEstado(io, lobby);
      if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:cantar-truco", ({ lobbyId }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.cantarTruco(socket.id);
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:responder-truco", ({ lobbyId, quiero }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.responderTruco(socket.id, quiero);
      emitirEstado(io, lobby);
      if (!lobby.engine.manoTerminada) armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:cantar-envido", ({ lobbyId, tipo }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.cantarEnvido(socket.id, tipo);
      emitirEstado(io, lobby);
      armarTimerJugada(io, lobby);
      cb?.({ ok: true });
    } catch (e) { cb?.({ ok: false, error: e.message }); }
  });

  socket.on("juego:responder-envido", ({ lobbyId, quiero }, cb) => {
    try {
      const lobby = lobbyManager.get(lobbyId);
      lobby.engine.responderEnvido(socket.id, quiero);
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

  socket.on("disconnect", () => {
    for (const lobby of lobbyManager.lobbies.values()) {
      if (lobby.jugadores.some((j) => j.id === socket.id)) {
        lobbyManager.salir(lobby.id, socket.id);
        io.to(lobby.id).emit("lobby:jugadores", lobby.jugadores);
        io.emit("lobby:actualizado", lobbyManager.listarPublicos());
      }
    }
  });
}
