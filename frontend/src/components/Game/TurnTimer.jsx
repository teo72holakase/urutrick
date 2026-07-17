import { useEffect, useState } from "react";

// Temporizador puramente visual (la autoridad del tiempo la tiene el backend).
export default function TurnTimer({ activo, segundos = 20, resetKey }) {
  const [restante, setRestante] = useState(segundos);

  useEffect(() => {
    setRestante(segundos);
    if (!activo) return;
    const interval = setInterval(() => {
      setRestante((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activo, resetKey, segundos]);

  if (!activo) return null;
  return <span className="temporizador">⏳ {restante}s</span>;
}
