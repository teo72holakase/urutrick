// Sprite de baraja española (Ludoteka): 10 columnas x 4 filas.
// Se usa background-size en % del contenedor de la celda, así no depende
// del tamaño real en píxeles del archivo (más robusto ante variaciones).
const SPRITE_URL = "https://www.ludoteka.com/img/img_laboratorio/baraja_es_120.png";
const COLUMNAS_NUMERO = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const FILAS_PALO = ["oro", "copa", "espada", "basto"];
const COLS = COLUMNAS_NUMERO.length;
const FILAS = FILAS_PALO.length;

function posicionSprite(carta) {
  const col = COLUMNAS_NUMERO.indexOf(carta.numero);
  const fila = FILAS_PALO.indexOf(carta.palo);
  // posición en % dentro del sprite completo (0% a 100%)
  const posX = (col / (COLS - 1)) * 100;
  const posY = (fila / (FILAS - 1)) * 100;
  return { posX, posY };
}

export default function PlayingCard({ carta, tapada, jugable, onClick, diseño = "clasico", className = "" }) {
  if (tapada || !carta) {
    return <div className={`carta tapada diseño-${diseño} ${className}`} />;
  }
  const { posX, posY } = posicionSprite(carta);
  return (
    <div
      className={`carta carta-sprite diseño-${diseño} ${jugable ? "jugable" : ""} ${className}`}
      style={{
        backgroundImage: `url(${SPRITE_URL})`,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundSize: `${COLS * 100}% ${FILAS * 100}%`,
      }}
      onClick={jugable ? onClick : undefined}
      title={`${carta.numero} de ${carta.palo}`}
    />
  );
}