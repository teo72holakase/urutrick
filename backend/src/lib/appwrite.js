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
const COL_RANKING = process.env.APPWRITE_RANKING_COLLECTION_ID || "ranking";

export async function guardarHistorial(lobby, equipoGanador) {
  if (!habilitado) return; // no configurado: no hace nada, sin romper el juego
  await databases.createDocument(DB_ID, COL_HISTORIAL, ID.unique(), {
    lobbyId: lobby.id,
    modo: lobby.modo,
    jugadores: lobby.jugadores.map((j) => `${j.id}:${j.nombre}:${j.equipo}`),
    equipoGanador,
    puntosA: lobby.engine.puntos.A,
    puntosB: lobby.engine.puntos.B,
    fecha: new Date().toISOString(),
  });

  for (const j of lobby.jugadores) {
    const gano = j.equipo === equipoGanador;
    await actualizarRanking(j.id, j.nombre, gano);
  }
}

async function actualizarRanking(userId, nombre, gano) {
  try {
    const res = await databases.listDocuments(DB_ID, COL_RANKING, [Query.equal("userId", userId)]);
    if (res.documents.length > 0) {
      const doc = res.documents[0];
      await databases.updateDocument(DB_ID, COL_RANKING, doc.$id, {
        victorias: doc.victorias + (gano ? 1 : 0),
        derrotas: doc.derrotas + (gano ? 0 : 1),
      });
    } else {
      await databases.createDocument(DB_ID, COL_RANKING, ID.unique(), {
        userId, nombre, victorias: gano ? 1 : 0, derrotas: gano ? 0 : 1,
      });
    }
  } catch (e) {
    console.error("Error actualizando ranking:", e.message);
  }
}
