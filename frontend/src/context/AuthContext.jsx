import { createContext, useContext, useEffect, useState } from "react";
import { account, ID } from "../lib/appwrite";

const AuthContext = createContext(null);

function emailDesdeUsuario(usuario) {
  const limpio = usuario.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${limpio}@truco.uy`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    account.get().then(setUser).catch(() => setUser(null)).finally(() => setCargando(false));
  }, []);

  async function registrarse(usuario, password) {
    const email = emailDesdeUsuario(usuario);
    await account.create(ID.unique(), email, password, usuario);
    await iniciarSesion(usuario, password);
  }

  async function iniciarSesion(usuario, password) {
    const email = emailDesdeUsuario(usuario);
    await account.createEmailPasswordSession(email, password);
    const u = await account.get();
    setUser(u);
    return u;
  }

  async function cerrarSesion() {
    await account.deleteSession("current");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, cargando, registrarse, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
