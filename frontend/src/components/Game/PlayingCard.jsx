// Sprite de baraja española: https://www.ludoteka.com/img/img_laboratorio/baraja_es_120.png
// Layout asumido: 10 columnas (1,2,3,4,5,6,7,10,11,12) x 4 filas (oros,copas,espadas,bastos),
// celda de 120x180px (hoja completa 1200x720). Si el recorte no calza con la imagen real,
// ajustá SPRITE_CELL_W / SPRITE_CELL_H y el orden de FILAS_PALO más abajo — son los únicos
// 3 valores que dependen del archivo.
const SPRITE_URL = "https://www.ludoteka.com/img/img_laboratorio/baraja_es_120.png";
const SPRITE_CELL_W = 120;
const SPRITE_CELL_H = 180;
const COLUMNAS_NUMERO = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const FILAS_PALO = ["oro", "copa", "espada", "basto"];

function posicionSprite(carta) {
  const col = COLUMNAS_NUMERO.indexOf(carta.numero);
  const fila = FILAS_PALO.indexOf(carta.palo);
  return { x: col * SPRITE_CELL_W, y: fila * SPRITE_CELL_H };
}

export default function PlayingCard({ carta, tapada, jugable, onClick, diseño = "clasico", className = "" }) {
  if (tapada || !carta) {
    return <div className={`carta tapada ${className}`} />;
  }
  const { x, y } = posicionSprite(carta);
  const filtro = diseño === "taberna" ? "sepia(0.35) saturate(1.2)" : diseño === "minimal" ? "grayscale(0.5)" : "none";
  return (
    <div
      className={`carta carta-sprite ${jugable ? "jugable" : ""} ${className}`}
      style={{
        backgroundImage: `url(${SPRITE_URL})`,
        backgroundPosition: `-${x}px -${y}px`,
        backgroundSize: `${SPRITE_CELL_W * COLUMNAS_NUMERO.length}px ${SPRITE_CELL_H * FILAS_PALO.length}px`,
        filter: filtro,
      }}
      onClick={jugable ? onClick : undefined}
      title={`${carta.numero} de ${carta.palo}`}
    />
  );
}