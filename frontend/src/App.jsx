import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import AuthForm from "./components/Auth/AuthForm";
import ThemeToggle from "./components/Layout/ThemeToggle";
import RulesModal from "./components/Rules/RulesModal";
import LobbyBrowser from "./components/Lobby/LobbyBrowser";
import WaitingRoom from "./components/Lobby/WaitingRoom";
import GameTable from "./components/Game/GameTable";
import { socket, conectarComo } from "./lib/socket";

export default function App() {
  const { user, cargando, cerrarSesion } = useAuth();
  const { diseñoCarta, setDiseñoCarta } = useTheme();
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [lobby, setLobby] = useState(null);
  const [enJuego, setEnJuego] = useState(false);

  // Conectar el socket con identidad persistente (Appwrite user id) y reintentar
  // reconexión a una mesa guardada en localStorage si el usuario refrescó la página.
  useEffect(() => {
    if (!user) return;
    conectarComo(user.$id, user.name);
    const lobbyGuardado = localStorage.getItem("lobbyId");
    if (lobbyGuardado) {
      socket.emit("lobby:reconectar", { lobbyId: lobbyGuardado }, (res) => {
        if (res?.ok) {
          setLobby(res.lobby);
          setEnJuego(!!res.iniciado);
        } else {
          localStorage.removeItem("lobbyId");
        }
      });
    }
  }, [user]);

  function entrarLobby(l) {
    setLobby(l);
    localStorage.setItem("lobbyId", l.id);
  }

  function salirLobby() {
    if (lobby) socket.emit("lobby:salir", { lobbyId: lobby.id });
    localStorage.removeItem("lobbyId");
    setLobby(null);
    setEnJuego(false);
  }

  if (cargando) return <p style={{ textAlign: "center", marginTop: "4rem" }}>Cargando...</p>;
  if (!user) return <AuthForm />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 className="titulo">🃏 Truco Uruguayo</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select value={diseñoCarta} onChange={(e) => setDiseñoCarta(e.target.value)}>
            <option value="clasico">Baraja Clásica</option>
            <option value="taberna">Baraja Taberna</option>
            <option value="minimal">Baraja Minimal</option>
          </select>
          <ThemeToggle />
          <button className="btn btn-secundario" onClick={() => setMostrarReglas(true)}>📖 Reglas</button>
          {lobby && <button className="btn btn-secundario" onClick={salirLobby}>Salir de la mesa</button>}
          <button className="btn btn-secundario" onClick={() => { cerrarSesion(); socket.disconnect(); }}>Salir</button>
        </div>
      </header>

      {!lobby && <LobbyBrowser nombreJugador={user.name} onEntrarLobby={entrarLobby} />}
      {lobby && !enJuego && <WaitingRoom lobby={lobby} onIniciar={() => setEnJuego(true)} />}
      {lobby && enJuego && <GameTable lobby={lobby} userId={user.$id} />}

      {mostrarReglas && <RulesModal onClose={() => setMostrarReglas(false)} />}
    </div>
  );
}
