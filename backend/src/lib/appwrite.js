import "dotenv/config";
import { Client, Databases, Query, ID } from "node-appwrite";

const habilitado = !!(process.env.APPWRITE_PROJECT_ID && process.env.APPWRITE_API_KEY && process.env.APPWRITE_DATABASE_ID);

let databases = null;
if (habilitado) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  databases = new Databases(client);
}

const DB_ID = process.env.APPWRITE_DATABASE_ID;
const COL_HISTORIAL = process.env.APPWRITE_HISTORIAL_COLLECTION_ID || "historial";
const COL_RANKING   = process.env.APPWRITE_RANKING_COLLECTION_ID   || "ranking";

// ── Historial de partidas ────────────────────────────────────────────────────
export async function guardarHistorial(lobby, equipoGanador) {
  if (!habilitado) return;
  await databases.createDocument(DB_ID, COL_HISTORIAL, ID.unique(), {
    lobbyId: lobby.id,
    modo: lobby.modo,
    jugadores: lobby.jugadores.map((j) => `${j.id}:${j.nombre}:${j.equipo}`),
    equipoGanador,
    puntosA: lobby.engine.puntos.A,
    puntosB: lobby.engine.puntos.B,
    fecha: new Date().toISOString(),
  });
}

// ── Ranking persistido ───────────────────────────────────────────────────────
// Campos esperados en la colección "ranking":
//   userId (string), nombre (string),
//   manos (integer), mesas (integer), puntos (integer)

export async function cargarRanking() {
  if (!habilitado) return [];
  try {
    const res = await databases.listDocuments(DB_ID, COL_RANKING, [Query.limit(1000)]);
    return res.documents.map((d) => ({
      userId: d.userId,
      nombre:  d.nombre  || "",
      manos:   d.manos   || 0,
      mesas:   d.mesas   || 0,
      puntos:  d.puntos  || 0,
    }));
  } catch (e) {
    console.error("Error cargando ranking:", e.message);
    return [];
  }
}

export async function guardarEstadistica({ userId, nombre, manos, mesas, puntos }) {
  if (!habilitado) return;
  try {
    const res = await databases.listDocuments(DB_ID, COL_RANKING, [Query.equal("userId", userId)]);
    const data = { nombre, manos, mesas, puntos };
    if (res.documents.length > 0) {
      await databases.updateDocument(DB_ID, COL_RANKING, res.documents[0].$id, data);
    } else {
      await databases.createDocument(DB_ID, COL_RANKING, ID.unique(), { userId, ...data });
    }
  } catch (e) {
    console.error("Error guardando estadística:", e.message);
  }
}

export async function buscarJugadorPorNombre(nombre) {
  if (!habilitado) return null;
  try {
    const res = await databases.listDocuments(DB_ID, COL_RANKING, [Query.equal("nombre", nombre)]);
    if (!res.documents.length) return null;
    const d = res.documents[0];
    return { nombre: d.nombre, manos: d.manos || 0, mesas: d.mesas || 0, puntos: d.puntos || 0 };
  } catch (e) {
    console.error("Error buscando jugador:", e.message);
    return null;
  }
}
