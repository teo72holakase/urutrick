import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { registrarHandlers } from "./socket/handlers.js";

// Red de seguridad: un error no capturado en cualquier parte del código NO debe
// tirar abajo el servidor entero (eso es lo que causaba los 502/CORS: todo el
// proceso de Node moría y Render tardaba en reiniciarlo, dejando a todos afuera).
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.get("/health", (req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  registrarHandlers(io, socket);
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Servidor truco corriendo en puerto ${PORT}`));