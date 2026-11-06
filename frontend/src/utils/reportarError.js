// Envía al backend los errores que ocurren en el navegador, para verlos en los logs del servidor
// (y por email si el backend tiene ALERT_EMAIL). No manda datos personales: solo el error y la página.
import { API_URL } from "../config/api";

const enviados = new Set(); // no repetir el mismo error en la misma visita
let total = 0;

export function reportarError(error, extra = {}) {
  try {
    const message = String(error?.message || error || "Error desconocido").slice(0, 300);
    if (enviados.has(message) || total >= 10) return;
    enviados.add(message);
    total++;
    const body = JSON.stringify({
      message,
      stack: String(error?.stack || extra.componentStack || "").slice(0, 2000),
      url: window.location.pathname, // sin parámetros (pueden traer tokens, como el de recuperar contraseña)
      userAgent: navigator.userAgent
    });
    fetch(`${API_URL}/api/client-errors`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // nunca romper la app por reportar un error
  }
}

// Errores que no atrapa React (en eventos, promesas, etc.)
export function escucharErroresGlobales() {
  window.addEventListener("error", (e) => reportarError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => reportarError(e.reason));
}
