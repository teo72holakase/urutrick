import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import AuthForm from "./components/Auth/AuthForm";
import ThemeToggle from "./components/Layout/ThemeToggle";
import RulesModal from "./components/Rules/RulesModal";
import LobbyBrowser from "./components/Lobby/LobbyBrowser";
import WaitingRoom from "./components/Lobby/WaitingRoom";
import GameTable from "./components/Game/GameTable";
import { socket } from "./lib/socket";

export default function App() {
  const { user, cargando, cerrarSesion } = useAuth();
  const { diseñoCarta, setDiseñoCarta } = useTheme();
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [lobby, setLobby] = useState(null);
  const [enJuego, setEnJuego] = useState(false);

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
          <button className="btn btn-secundario" onClick={() => { cerrarSesion(); socket.disconnect(); }}>Salir</button>
        </div>
      </header>

      {!lobby && <LobbyBrowser nombreJugador={user.name} onEntrarLobby={setLobby} />}
      {lobby && !enJuego && <WaitingRoom lobby={lobby} onIniciar={() => setEnJuego(true)} />}
      {lobby && enJuego && <GameTable lobby={lobby} userId={socket.id} />}

      {mostrarReglas && <RulesModal onClose={() => setMostrarReglas(false)} />}
    </div>
  );
}
