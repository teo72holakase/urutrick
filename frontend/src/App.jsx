import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import AuthForm from "./components/Auth/AuthForm";
import ThemeToggle from "./components/Layout/ThemeToggle";
import RulesModal from "./components/Rules/RulesModal";
import LobbyBrowser from "./components/Lobby/LobbyBrowser";
import WaitingRoom from "./components/Lobby/WaitingRoom";
import GameTable from "./components/Game/GameTable";
import { socket, conectarComo } from "./lib/socket";

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
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [lobby, setLobby] = useState(null);
  const [enJuego, setEnJuego] = useState(false);
  const [esEspectador, setEsEspectador] = useState(false);
  const [estadoJuego, setEstadoJuego] = useState(null);
  const [finPartida, setFinPartida] = useState(null);

  // Escuchas globales de partida: registradas desde el primer render, así nunca se
  // pierde un "estado" que el server mande justo cuando recién arranca el juego o
  // justo después de reconectar (antes esto se perdía por una condición de carrera).
  useEffect(() => {
    function onEstado(e) { setEstadoJuego(e); }
    function onFin(f) { setFinPartida(f); }
    // Importante: esto actualiza lobby.jugadores en vivo. Sin esto, el jugador que
    // CREÓ la mesa se quedaba con el lobby "viejo" (con solo él adentro) para
    // siempre, porque WaitingRoom guardaba los jugadores actualizados en un estado
    // propio que nunca subía hasta acá — y al arrancar la partida, GameTable
    // terminaba usando ese lobby viejo, sin el rival (no se le veían sus cartas,
    // ni el dorso, ni las que jugaba).
    function onJugadores(jugadores) {
      setLobby((prev) => (prev ? { ...prev, jugadores } : prev));
    }
    socket.on("estado", onEstado);
    socket.on("fin-partida", onFin);
    socket.on("lobby:jugadores", onJugadores);
    return () => {
      socket.off("estado", onEstado);
      socket.off("fin-partida", onFin);
      socket.off("lobby:jugadores", onJugadores);
    };
  }, []);

  // Conexión + reconexión: se re-ejecuta en cada "connect" del socket (primera vez,
  // y también si hubo un corte de red y reconectó solo), no solo al montar.
  useEffect(() => {
    if (!user) return;
    conectarComo(user.$id, user.name);

    function alConectar() {
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
    }

    socket.on("connect", alConectar);
    if (socket.connected) alConectar();
    return () => socket.off("connect", alConectar);
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
    setEstadoJuego(null);
    setFinPartida(null);
    irAUrl(null);
  }

  if (cargando) return <p style={{ textAlign: "center", marginTop: "4rem" }}>Cargando...</p>;
  if (!user) return <AuthForm />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <header className="header-app">
        <h1 className="titulo">
          <img src="/urutrick.png" alt="" className="titulo-icono titulo-icono-grande" /> UruTrick
        </h1>
        <div className="header-acciones">
          <ThemeToggle />
          <button className="btn btn-secundario" onClick={() => setMostrarReglas(true)}>📖 Reglas</button>
          {lobby && <button className="btn btn-secundario" onClick={salirLobby}>{esEspectador ? "Dejar de espectar" : "Salir de la mesa"}</button>}
          <button className="btn btn-secundario" onClick={() => { cerrarSesion(); socket.disconnect(); }}>Salir</button>
        </div>
      </header>

      {!lobby && <LobbyBrowser nombreJugador={user.name} onEntrarLobby={entrarLobby} onEspectar={espectarLobby} />}
      {lobby && !enJuego && !esEspectador && <WaitingRoom lobby={lobby} onIniciar={() => setEnJuego(true)} />}
      {lobby && !enJuego && esEspectador && <p className="panel" style={{ textAlign: "center" }}>Esperando a que la mesa <b>{lobby.nombre}</b> arranque...</p>}
      {lobby && enJuego && (
        <GameTable
          lobby={lobby}
          userId={user.$id}
          esEspectador={esEspectador}
          estado={estadoJuego}
          finPartida={finPartida}
          onVolverMenu={salirLobby}
        />
      )}

      {mostrarReglas && <RulesModal onClose={() => setMostrarReglas(false)} />}
    </div>
  );
}
