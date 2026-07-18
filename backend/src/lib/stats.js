// Leaderboard en memoria (se reinicia si se reinicia el servidor). Acumula por
// jugador: manos ganadas, mesas (partidas) ganadas y puntos hechos.
const stats = new Map(); // userId -> { userId, nombre, manos, mesas, puntos }

function entrada(userId, nombre) {
  let e = stats.get(userId);
  if (!e) {
    e = { userId, nombre, manos: 0, mesas: 0, puntos: 0 };
    stats.set(userId, e);
  }
  if (nombre) e.nombre = nombre;
  return e;
}

export function registrarMano(lobby, equipoGanador) {
  if (!equipoGanador || equipoGanador === "parda") return;
  for (const j of lobby.jugadores) {
    if (j.equipo === equipoGanador) entrada(j.id, j.nombre).manos += 1;
  }
}

export function registrarPartida(lobby, equipoGanador) {
  const puntos = lobby.engine?.puntos || { A: 0, B: 0 };
  for (const j of lobby.jugadores) {
    const e = entrada(j.id, j.nombre);
    e.puntos += puntos[j.equipo] || 0;
    if (j.equipo === equipoGanador) e.mesas += 1;
  }
}

export function leaderboard() {
  const arr = [...stats.values()];
  const top = (campo) => arr
    .filter((e) => e[campo] > 0)
    .sort((a, b) => b[campo] - a[campo])
    .slice(0, 5)
    .map((e) => ({ nombre: e.nombre, valor: e[campo] }));
  return { manos: top("manos"), mesas: top("mesas"), puntos: top("puntos") };
}
