import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
  const { tema, setTema } = useTheme();
  return (
    <button className="btn btn-secundario" onClick={() => setTema(tema === "oscuro" ? "claro" : "oscuro")}>
      {tema === "oscuro" ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
