import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem("petu_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (auth) localStorage.setItem("petu_auth", JSON.stringify(auth));
    else localStorage.removeItem("petu_auth");
  }, [auth]);

  const login = ({ token, user }) => {
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
