import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { registrarHandlers } from "./socket/handlers.js";

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
