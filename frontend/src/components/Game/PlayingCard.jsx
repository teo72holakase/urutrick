// Imágenes locales en frontend/public/cards/ (servidas en runtime como /cards/...).
// Convención de nombres esperada (renombrá tus 41 archivos así antes de subirlos):
//   /cards/oro-1.png ... oro-7.png, oro-10.png, oro-11.png, oro-12.png
//   /cards/copa-1.png ... copa-12.png (mismos números que arriba)
//   /cards/espada-1.png ... espada-12.png
//   /cards/basto-1.png ... basto-12.png
//   /cards/back.png   (reverso, el archivo #41)
export default function PlayingCard({ carta, tapada, jugable, onClick, className = "" }) {
  if (tapada || !carta) {
    return <img src="/cards/back.png" className={`carta ${className}`} alt="" draggable={false} />;
  }
  return (
    <img
      src={`/cards/${carta.palo}-${carta.numero}.png`}
      className={`carta ${jugable ? "jugable" : ""} ${className}`}
      onClick={jugable ? onClick : undefined}
      alt={`${carta.numero} de ${carta.palo}`}
      draggable={false}
    />
  );
}
