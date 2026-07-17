// Sprite de baraja española (Ludoteka), tamaño real: 960x480px, 10 cols x 4 filas
// => cada celda mide 96x120px (proporción 4:5). .carta en global.css respeta esa
// misma proporción (64x80, 46x57.5) para que el sprite no se deforme al estirarse.
// La fórmula de recorte usa % (relativo al propio contenedor, no px fijos), así
// escala sola sin JS sin importar si .carta mide 64px o 46px.
const SPRITE_URL = "https://www.ludoteka.com/img/img_laboratorio/baraja_es_120.png";
const COLUMNAS_NUMERO = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const FILAS_PALO = ["oro", "copa", "espada", "basto"];
const COLS = COLUMNAS_NUMERO.length; // 10
const FILAS = FILAS_PALO.length; // 4

function posicionSprite(carta) {
  const col = COLUMNAS_NUMERO.indexOf(carta.numero);
  const fila = FILAS_PALO.indexOf(carta.palo);
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