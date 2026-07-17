import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_BACKEND_URL, {
  autoConnect: false,
});

export function conectarComo(userId, nombre) {
  socket.auth = { userId, nombre };
  if (!socket.connected) socket.connect();
}
