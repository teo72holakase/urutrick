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

// ID de mesa tomado directo de la URL: urutrick.vercel.app/{lobbyId}
function idDesdeUrl() {
  const path = window.location.pathname.replace(/^\/+/, "");
  return path || null;
}

function irAUrl(lobbyId) {
  const destino = lobbyId ? `/${lobbyId}` : "/";
  if (window.location.pathname !== destino) window.history.pushState({}, "", destino);
}

export default function App() {
  const { user, cargando, cerrarSesion } = useAuth();
  const { diseñoCarta, setDiseñoCarta } = useTheme();
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [lobby, setLobby] = useState(null);
  const [enJuego, setEnJuego] = useState(false);
  const [esEspectador, setEsEspectador] = useState(false);

  // Al conectar: si la URL trae un ID de mesa, reconectamos o entramos como espectador.
  // Si no, y había una mesa guardada de una sesión previa, intentamos reconectar ahí.
  useEffect(() => {
    if (!user) return;
    conectarComo(user.$id, user.name);
    const idUrl = idDesdeUrl();
    const lobbyGuardado = localStorage.getItem("lobbyId");
    const objetivo = idUrl || lobbyGuardado;
    if (!objetivo) return;

    socket.emit("lobby:reconectar", { lobbyId: objetivo }, (res) => {
      if (res?.ok) {
        setLobby(res.lobby);
        setEnJuego(!!res.iniciado);
        setEsEspectador(!!res.esEspectador);
        localStorage.setItem("lobbyId", objetivo);
        irAUrl(objetivo);
      } else if (idUrl) {
        // No soy jugador ni espectador todavía: consultamos la mesa para ofrecer espectar.
        socket.emit("lobby:info", idUrl, (info) => {
          if (info?.ok) {
            socket.emit("lobby:espectar", { lobbyId: idUrl, nombre: user.name }, (r) => {
              if (r?.ok) {
                setLobby(r.lobby);
                setEnJuego(!!r.iniciado);
                setEsEspectador(true);
                localStorage.setItem("lobbyId", idUrl);
              }
            });
          } else {
            irAUrl(null);
          }
        });
      } else {
        localStorage.removeItem("lobbyId");
      }
    });
  }, [user]);

  function entrarLobby(l) {
    setLobby(l);
    setEsEspectador(false);
    localStorage.setItem("lobbyId", l.id);
    irAUrl(l.id);
  }

  function espectarLobby(lobbyId) {
    socket.emit("lobby:espectar", { lobbyId, nombre: user.name }, (res) => {
      if (res?.ok) {
        setLobby(res.lobby);
        setEnJuego(!!res.iniciado);
        setEsEspectador(true);
        localStorage.setItem("lobbyId", lobbyId);
        irAUrl(lobbyId);
      }
    });
  }

  function salirLobby() {
    if (lobby) socket.emit("lobby:salir", { lobbyId: lobby.id });
    localStorage.removeItem("lobbyId");
    setLobby(null);
    setEnJuego(false);
    setEsEspectador(false);
    irAUrl(null);
  }

  if (cargando) return <p style={{ textAlign: "center", marginTop: "4rem" }}>Cargando...</p>;
  if (!user) return <AuthForm />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 className="titulo">🃏 UruTrick</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select value={diseñoCarta} onChange={(e) => setDiseñoCarta(e.target.value)}>
            <option value="clasico">Baraja Clásica</option>
            <option value="taberna">Baraja Taberna</option>
            <option value="minimal">Baraja Minimal</option>
          </select>
          <ThemeToggle />
          <button className="btn btn-secundario" onClick={() => setMostrarReglas(true)}>📖 Reglas</button>
          {lobby && <button className="btn btn-secundario" onClick={salirLobby}>{esEspectador ? "Dejar de espectar" : "Salir de la mesa"}</button>}
          <button className="btn btn-secundario" onClick={() => { cerrarSesion(); socket.disconnect(); }}>Salir</button>
        </div>
      </header>

      {!lobby && <LobbyBrowser nombreJugador={user.name} onEntrarLobby={entrarLobby} onEspectar={espectarLobby} />}
      {lobby && !enJuego && !esEspectador && <WaitingRoom lobby={lobby} onIniciar={() => setEnJuego(true)} />}
      {lobby && !enJuego && esEspectador && <p className="panel" style={{ textAlign: "center" }}>Esperando a que la mesa <b>{lobby.nombre}</b> arranque...</p>}
      {lobby && enJuego && <GameTable lobby={lobby} userId={user.$id} esEspectador={esEspectador} />}

      {mostrarReglas && <RulesModal onClose={() => setMostrarReglas(false)} />}
    </div>
  );
}