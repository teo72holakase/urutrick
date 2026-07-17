import { createContext, useContext, useEffect, useState } from "react";
import { account, ID } from "../lib/appwrite";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    account.get().then(setUser).catch(() => setUser(null)).finally(() => setCargando(false));
  }, []);

  async function registrarse(email, password, nombre) {
    await account.create(ID.unique(), email, password, nombre);
    await iniciarSesion(email, password);
  }

  async function iniciarSesion(email, password) {
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
