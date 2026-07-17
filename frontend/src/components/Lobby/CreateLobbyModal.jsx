import { useState } from "react";

export default function CreateLobbyModal({ onCrear, onClose }) {
  const [nombre, setNombre] = useState("");
  const [modo, setModo] = useState("1v1");
  const [tienePassword, setTienePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [verCartasCompanero, setVerCartasCompanero] = useState(false);

  function submit(e) {
    e.preventDefault();
    onCrear({ nombre, modo, password: tienePassword ? password : null, verCartasCompanero });
  }

  return (
    <div className="modal-fondo" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo">Nueva mesa</h2>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <input placeholder="Nombre de la mesa" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <label>
            Modo
            <select value={modo} onChange={(e) => setModo(e.target.value)} style={{ width: "100%" }}>
              <option value="1v1">1 vs 1</option>
              <option value="2v2">2 vs 2</option>
              <option value="3v3">3 vs 3</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={tienePassword} onChange={(e) => setTienePassword(e.target.checked)} />
            Proteger con contraseña
          </label>
          {tienePassword && (
            <input placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          {modo !== "1v1" && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={verCartasCompanero} onChange={(e) => setVerCartasCompanero(e.target.checked)} />
              Ver cartas del compañero
            </label>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn" type="submit">Crear</button>
            <button className="btn btn-secundario" type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}