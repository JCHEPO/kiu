import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./app.jsx";
import { AuthProvider } from "./context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Si algo falla al dibujar la app, mostrar un aviso con "Recargar" en vez de una pantalla en blanco.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Error en la app:", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: "18px", margin: 0 }}>Algo salió mal al cargar Kiu.</p>
        <button
          onClick={() => window.location.assign("/")}
          style={{ padding: "10px 20px", fontSize: "16px", borderRadius: "8px", border: "none", background: "#111", color: "#fff", cursor: "pointer" }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }
}

const app = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* El proveedor de Google solo se carga si hay client ID (ver HomePage: GoogleButton) */}
      {GOOGLE_CLIENT_ID ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider> : app}
    </ErrorBoundary>
  </React.StrictMode>
);
