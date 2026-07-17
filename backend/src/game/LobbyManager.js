import { v4 as uuid } from "uuid";
import { GameEngine } from "./GameEngine.js";

const CAPACIDAD = { "1v1": 2, "2v2": 4, "3v3": 6 };

export class LobbyManager {
  constructor() {
    this.lobbies = new Map(); // id -> lobby
  }

  listarPublicos() {
    return [...this.lobbies.values()]
      .filter((l) => !l.iniciado)
      .map((l) => ({
        id: l.id,
        nombre: l.nombre,
        modo: l.modo,
        jugadores: l.jugadores.length,
        capacidad: CAPACIDAD[l.modo],
        tienePassword: !!l.password,
      }));
  }

  crear({ nombre, modo, password, verCartasCompanero, creador }) {
    const id = uuid().slice(0, 8);
    const lobby = {
      id,
      nombre: nombre || `Mesa ${id}`,
      modo, // '1v1' | '2v2' | '3v3'
      password: password || null,
      verCartasCompanero: !!verCartasCompanero,
      jugadores: [{ id: creador.id, nombre: creador.nombre, equipo: "A" }],
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

  salir(lobbyId, jugadorId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    lobby.jugadores = lobby.jugadores.filter((j) => j.id !== jugadorId);
    if (lobby.jugadores.length === 0) this.lobbies.delete(lobbyId);
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
}
