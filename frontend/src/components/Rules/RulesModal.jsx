import { useState } from "react";

const CONTENIDO = {
  general: {
    titulo: "Valores de las cartas (de mayor a menor)",
    texto: [
      "PIEZAS (palo de la muestra): son las más fuertes de todas, por encima del ancho de espada. Orden: 2 > 4 > 5 > 11 > 10 de la muestra. Si la muestra es una pieza, el 12 de ese palo la reemplaza.",
      "1° Ancho de espada (matacas)",
      "2° Ancho de basto",
      "3° Siete de espada",
      "4° Siete de oro",
      "5° Los tres (espada, basto, oro, copa)",
      "6° Los dos (espada, basto, oro, copa)",
      "7° Anchos falsos: 1 de oro y 1 de copa",
      "8° Los doce, once y diez (figuras)",
      "9° Siete de basto y siete de copa (falsos)",
      "10° Los seis, cinco y cuatro",
    ],
  },
  "1v1": {
    titulo: "Truco 1 vs 1 (mano a mano)",
    texto: [
      "Cada jugador recibe 3 cartas. Se juegan hasta 3 bazas (manos) por ronda.",
      "Gana la ronda quien gane 2 de las 3 bazas.",
      "El 'mano' (marcado con la ficha ✋) es quien reparte y juega primero.",
      "Se puede cantar Envido antes de jugar la primera carta.",
      "Partida a 30 puntos (algunas mesas juegan a 15).",
    ],
  },
  "2v2": {
    titulo: "Truco 2 vs 2 (por parejas)",
    texto: [
      "Dos equipos de 2 jugadores, sentados alternados.",
      "El envido y el truco se cantan en representación del equipo: alcanza con que un compañero conteste.",
      "El envido de un equipo se calcula con el mejor puntaje entre ambos compañeros.",
      "Opcional (según lobby): ver las cartas del compañero para coordinar mejor.",
      "Partida a 30 puntos.",
    ],
  },
  "3v3": {
    titulo: "Truco 3 vs 3",
    texto: [
      "Dos equipos de 3 jugadores, turnos alternados por equipo.",
      "Mismas reglas que 2v2, pero con más jugadores por bando: el envido usa el mejor puntaje de los tres compañeros.",
      "El truco puede ser respondido por cualquier integrante del equipo rival.",
      "Partida a 30 puntos.",
    ],
  },
  cantos: {
    titulo: "Cómo y cuándo se canta",
    texto: [
      "ENVIDO: se canta antes de jugar la primera carta. Suma los puntos de dos cartas del mismo palo (+20) o el valor más alto de una sola carta. Las figuras (10,11,12) valen 0.",
      "Escalada de envido: Envido → Envido (acumula) → Real Envido → Falta Envido. La Falta Envido también puede cantarse de entrada.",
      "TRUCO: se puede cantar en cualquier momento del juego. Escala: Truco → Retruco → Vale Cuatro.",
      "Ante un canto, se responde: 'Quiero', 'No quiero', o se escala al siguiente nivel.",
      "Si no se responde a tiempo, el sistema juega 'No quiero' automáticamente.",
      "FLOR (si está habilitada en la mesa): hay flor con 3 del mismo palo, o usando las piezas (cartas del palo de la muestra) como comodín: 1 pieza + 2 del mismo palo, o 2 piezas + 1 cualquiera.",
      "Si tenés flor no podés cantar envido (la flor lo reemplaza). Un solo equipo con flor suma 3. Si ambos equipos tienen flor, se disputan los puntos.",
    ],
  },
};

export default function RulesModal({ onClose }) {
  const [tab, setTab] = useState("general");
  return (
    <div className="modal-fondo" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo">Reglas del Truco Uruguayo</h2>
        <div className="tabs">
          {Object.keys(CONTENIDO).map((k) => (
            <button key={k} className={`tab ${tab === k ? "activo" : ""}`} onClick={() => setTab(k)}>
              {k === "general" ? "Cartas" : k === "cantos" ? "Cantos" : k}
            </button>
          ))}
        </div>
        <h3>{CONTENIDO[tab].titulo}</h3>
        <ul>
          {CONTENIDO[tab].texto.map((linea, i) => <li key={i} style={{ marginBottom: "0.4rem" }}>{linea}</li>)}
        </ul>
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
