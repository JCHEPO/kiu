import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setError("");
    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setDone(true);
    } catch {
      setError("Error de conexión");
    }
  };

  const styles = {
    wrapper: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: "#e8e8e8"
    },
    card: {
      background: "#fff",
      borderRadius: "16px",
      padding: "40px",
      width: "400px",
      maxWidth: "90vw",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
    },
    title: {
      fontSize: "28px",
      fontWeight: 900,
      marginBottom: "8px",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      textAlign: "center"
    },
    subtitle: {
      fontSize: "14px",
      color: "#666",
      marginBottom: "25px",
      textAlign: "center",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    input: {
      width: "100%",
      padding: "12px 15px",
      border: "2px solid #ddd",
      borderRadius: "8px",
      fontSize: "16px",
      marginBottom: "12px",
      boxSizing: "border-box",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      outline: "none"
    },
    button: {
      width: "100%",
      padding: "14px",
      backgroundColor: "#000",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontSize: "18px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginBottom: "12px"
    },
    error: {
      color: "#ff4444",
      fontSize: "14px",
      marginBottom: "12px",
      textAlign: "center"
    },
    success: {
      textAlign: "center",
      padding: "20px",
      color: "#2e7d32",
      fontSize: "15px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      fontWeight: "bold",
      background: "#e8f5e9",
      borderRadius: "8px",
      marginBottom: "16px"
    }
  };

  if (!token) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.title}>Link inválido</div>
          <div style={{ ...styles.subtitle, color: "#ff4444" }}>
            El link de recuperación no es válido o expiró.
          </div>
          <button style={styles.button} onClick={() => navigate("/")}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.title}>Nueva contraseña</div>
        <div style={styles.subtitle}>Elige una contraseña segura</div>

        {error && <div style={styles.error}>{error}</div>}

        {done ? (
          <>
            <div style={styles.success}>
              ✓ Contraseña actualizada correctamente
            </div>
            <button style={styles.button} onClick={() => navigate("/")}>
              Ir al inicio
            </button>
          </>
        ) : (
          <>
            <input
              style={styles.input}
              type="password"
              placeholder="Nueva contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Confirmar contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
            <button style={styles.button} onClick={handleReset}>
              Guardar contraseña
            </button>
          </>
        )}
      </div>
    </div>
  );
}
