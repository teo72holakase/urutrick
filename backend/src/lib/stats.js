// Leaderboard respaldado en Appwrite. La Map actúa como caché en memoria para
// lecturas rápidas; cada escritura también persiste en la base de datos.
import { cargarRanking, guardarEstadistica } from "./appwrite.js";

const stats = new Map(); // userId -> { userId, nombre, manos, mesas, puntos }

// Llamar en el arranque del servidor para hidratar la caché desde Appwrite.
export async function inicializarStats() {
  try {
    const datos = await cargarRanking();
    for (const d of datos) stats.set(d.userId, { ...d });
    console.log(`Stats cargadas: ${stats.size} jugadores`);
  } catch (e) {
    console.error("No se pudo cargar el ranking:", e.message);
  }
}

function entrada(userId, nombre) {
  let e = stats.get(userId);
  if (!e) { e = { userId, nombre, manos: 0, mesas: 0, puntos: 0 }; stats.set(userId, e); }
  if (nombre) e.nombre = nombre;
  return e;
}

export function registrarMano(lobby, equipoGanador) {
  if (!equipoGanador || equipoGanador === "parda") return;
  for (const j of lobby.jugadores) {
    if (j.equipo === equipoGanador) {
      const e = entrada(j.id, j.nombre);
      e.manos += 1;
      guardarEstadistica(e).catch(() => {});
    }
  }
}

export function registrarPartida(lobby, equipoGanador) {
  const puntos = lobby.engine?.puntos || { A: 0, B: 0 };
  for (const j of lobby.jugadores) {
    const e = entrada(j.id, j.nombre);
    e.puntos += puntos[j.equipo] || 0;
    if (j.equipo === equipoGanador) e.mesas += 1;
    guardarEstadistica(e).catch(() => {});
  }
}

export function leaderboard() {
  const arr = [...stats.values()];
  const top = (campo) =>
    arr.filter((e) => e[campo] > 0)
       .sort((a, b) => b[campo] - a[campo])
       .slice(0, 5)
       .map((e) => ({ nombre: e.nombre, valor: e[campo] }));
  return { manos: top("manos"), mesas: top("mesas"), puntos: top("puntos") };
}