const SIMBOLOS = { espada: "⚔️", basto: "🌿", oro: "🪙", copa: "🏆" };
const NOMBRES = { espada: "E", basto: "B", oro: "O", copa: "C" };

// diseños simples vía color de fondo/borde, fácil de ampliar
const DISEÑOS = {
  clasico: { fondo: "#fdf6e3", borde: "#2b1c12" },
  taberna: { fondo: "#f1dca0", borde: "#5a3a1a" },
  minimal: { fondo: "#ffffff", borde: "#333333" },
};

export default function PlayingCard({ carta, tapada, jugable, onClick, diseño = "clasico" }) {
  if (tapada || !carta) {
    return <div className="carta tapada" />;
  }
  const estilo = DISEÑOS[diseño] || DISEÑOS.clasico;
  return (
    <div
      className={`carta ${jugable ? "jugable" : ""}`}
      style={{ background: estilo.fondo, borderColor: estilo.borde }}
      onClick={jugable ? onClick : undefined}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.1rem" }}>{carta.numero}</div>
        <div>{SIMBOLOS[carta.palo]}</div>
        <div style={{ fontSize: "0.6rem" }}>{NOMBRES[carta.palo]}</div>
      </div>
    </div>
  );
}
