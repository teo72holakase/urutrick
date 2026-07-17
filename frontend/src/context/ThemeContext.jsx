import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(localStorage.getItem("tema") || "oscuro");
  const [diseñoCarta, setDiseñoCarta] = useState(localStorage.getItem("diseñoCarta") || "clasico");

  useEffect(() => {
    document.documentElement.setAttribute("data-tema", tema);
    localStorage.setItem("tema", tema);
  }, [tema]);

  useEffect(() => {
    localStorage.setItem("diseñoCarta", diseñoCarta);
  }, [diseñoCarta]);

  return (
    <ThemeContext.Provider value={{ tema, setTema, diseñoCarta, setDiseñoCarta }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
