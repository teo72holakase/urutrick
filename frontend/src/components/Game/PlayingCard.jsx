// Imágenes locales en frontend/public/cards/ (servidas en runtime como /cards/...).
// Convención de nombres esperada (renombrá tus 41 archivos así antes de subirlos):
//   /cards/oro-1.png ... oro-7.png, oro-10.png, oro-11.png, oro-12.png
//   /cards/copa-1.png ... copa-12.png (mismos números que arriba)
//   /cards/espada-1.png ... espada-12.png
//   /cards/basto-1.png ... basto-12.png
//   /cards/back.png   (reverso, el archivo #41)
const NOMBRE_NUM = { 1: "As", 10: "Sota", 11: "Caballo", 12: "Rey" };
const NOMBRE_PALO = { oro: "oro", copa: "copa", espada: "espada", basto: "basto" };

export function nombreCarta(carta) {
  if (!carta) return "";
  const num = NOMBRE_NUM[carta.numero] || carta.numero;
  return `${num} de ${NOMBRE_PALO[carta.palo] || carta.palo}`;
}

export default function PlayingCard({ carta, tapada, jugable, onClick, className = "" }) {
  if (tapada || !carta) {
    return <img src="/cards/back.PNG" className={`carta ${className}`} alt="" draggable={false} />;
  }
  const nombre = nombreCarta(carta);
  return (
    <img
      src={`/cards/${carta.palo}-${carta.numero}.PNG`}
      className={`carta ${jugable ? "jugable" : ""} ${className}`}
      onClick={jugable ? onClick : undefined}
      alt={nombre}
      title={nombre}
      draggable={false}
    />
  );
}
