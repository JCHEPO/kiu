import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

// Dónde se guarda la sesión en el navegador
const STORAGE_KEY = "kiu_auth";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      // "petu_auth" es el nombre antiguo: se lee para no cerrar la sesión de nadie (el efecto de abajo lo borra)
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("petu_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      else localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("petu_auth");
    } catch (e) {}
  }, [auth]);

  const login = ({ token, user }) => {
    // Guardar de inmediato: después del login se recarga o se navega a otra página,
    // y no hay que depender de que el useEffect alcance a correr antes.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user })); } catch (e) {}
    setAuth({ token, user });
  };

  const logout = () => {
    setAuth(null);
    window.location.href = "/";
  };

  const fetchWithAuth = async (url, opts = {}) => {
    const token = auth?.token;
    const headers = { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(url, { ...opts, headers });
    // Token inválido/expirado (p.ej. tras rotar JWT_SECRET) → cerrar sesión.
    // ProtectedRoute redirige al home; el usuario vuelve a loguearse con un token válido.
    if (res.status === 401 && token) setAuth(null);
    return res;
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
