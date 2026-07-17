import { v4 as uuid } from "uuid";
import { GameEngine } from "./GameEngine.js";

const CAPACIDAD = { "1v1": 2, "2v2": 4, "3v3": 6 };

export class LobbyManager {
  constructor() {
    this.lobbies = new Map(); // id -> lobby
  }

  listarPublicos() {
    return [...this.lobbies.values()]
      .map((l) => ({
        id: l.id,
        nombre: l.nombre,
        modo: l.modo,
        puntajeLimite: l.puntajeLimite,
        jugadores: l.jugadores.length,
        capacidad: CAPACIDAD[l.modo],
        tienePassword: !!l.password,
        iniciado: l.iniciado,
      }));
  }

  crear({ nombre, modo, password, verCartasCompanero, puntajeLimite, creador }) {
    const id = uuid().slice(0, 8);
    const lobby = {
      id,
      nombre: nombre || `Mesa ${id}`,
      modo, // '1v1' | '2v2' | '3v3'
      password: password || null,
      verCartasCompanero: !!verCartasCompanero,
      puntajeLimite: [15, 30, 40].includes(puntajeLimite) ? puntajeLimite : 30,
      jugadores: [{ id: creador.id, nombre: creador.nombre, equipo: "A" }],
      espectadores: [], // [{id, nombre}]
      iniciado: false,
      engine: null,
    };
    this.lobbies.set(id, lobby);
    return lobby;
  }

  unirse(lobbyId, { id, nombre }, password) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby no existe");
    if (lobby.password && lobby.password !== password) throw new Error("Contraseña incorrecta");
    if (lobby.jugadores.length >= CAPACIDAD[lobby.modo]) throw new Error("Lobby lleno");
    const cantA = lobby.jugadores.filter((j) => j.equipo === "A").length;
    const cantB = lobby.jugadores.filter((j) => j.equipo === "B").length;
    const equipo = cantA <= cantB ? "A" : "B";
    lobby.jugadores.push({ id, nombre, equipo });
    return lobby;
  }

  espectar(lobbyId, { id, nombre }) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby no existe");
    if (!lobby.espectadores.some((e) => e.id === id)) {
      lobby.espectadores.push({ id, nombre });
    }
    return lobby;
  }

  salir(lobbyId, jugadorId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    lobby.jugadores = lobby.jugadores.filter((j) => j.id !== jugadorId);
    lobby.espectadores = lobby.espectadores.filter((e) => e.id !== jugadorId);
    if (lobby.jugadores.length === 0 && lobby.espectadores.length === 0) this.lobbies.delete(lobbyId);
  }

  iniciar(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby no existe");
    if (lobby.jugadores.length !== CAPACIDAD[lobby.modo]) throw new Error("Faltan jugadores");
    lobby.iniciado = true;
    lobby.engine = new GameEngine(lobby);
    return lobby;
  }

  get(lobbyId) {
    return this.lobbies.get(lobbyId);
  }

  esJugador(lobbyId, userId) {
    const lobby = this.lobbies.get(lobbyId);
    return !!lobby?.jugadores.some((j) => j.id === userId);
  }
}