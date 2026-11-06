// Seguimiento de links compartidos (métrica "links que terminan en inscripción").
//
// Cada link de un evento lleva el id del evento en la ruta y el origen en ?o=:
//   https://kiu.../event/<id>?o=wa        (botón WhatsApp)
//   https://kiu.../event/<id>?o=compartir (menú compartir del teléfono)
//   https://kiu.../event/<id>?o=copia     (link copiado)
//   https://kiu.../event/<id>?o=qr        (afiche; cualquier texto corto sirve: ?o=afiche-cancha-1)
// Si alguien entra directo a un evento sin ?o= (p.ej. pegó la URL), cuenta como "directo".
//
// Al abrir el link se pide al backend un código de visita al azar y se guarda en este navegador
// por 7 días. Ese código viaja al crear la cuenta y al inscribirse; no identifica a la persona.

import { API_URL } from "../config/api";

const CLAVE = "kiu_visitas";
const DIAS = 7;
const VENTANA_MS = DIAS * 24 * 60 * 60 * 1000;
const ORIGEN_RE = /^[a-z0-9_-]{1,24}$/;

// Página con la que se abrió Kiu en esta pestaña (antes de cualquier navegación interna).
// Se captura al cargar el módulo, que se importa desde main.jsx.
export const PAGINA_DE_ENTRADA = typeof window !== "undefined" ? window.location.pathname : "";

export const origenValido = (o) => (typeof o === "string" && ORIGEN_RE.test(o) ? o : null);

export const linkDeEvento = (eventId, origen) =>
  `${window.location.origin}/event/${eventId}${origen ? `?o=${encodeURIComponent(origen)}` : ""}`;

const leer = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    const ahora = Date.now();
    // Se descartan las visitas de más de 7 días
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && typeof v.v === "string" && ahora - v.at < VENTANA_MS));
  } catch {
    return {};
  }
};

const escribir = (mapa) => {
  try { localStorage.setItem(CLAVE, JSON.stringify(mapa)); } catch { /* modo privado o almacenamiento lleno: se pierde la métrica, nada más */ }
};

/** Código de visita de este evento (si se abrió un link en los últimos 7 días). */
export const visitaDe = (eventId) => leer()[eventId]?.v || null;

/** La visita más reciente, para asociarla a una cuenta nueva. */
export const visitaReciente = () => {
  const lista = Object.values(leer()).sort((a, b) => b.at - a.at);
  return lista[0]?.v || null;
};

/**
 * Anota que se abrió el link de un evento. No hace nada si este navegador ya lo abrió en los
 * últimos 7 días. Nunca lanza: si falla, la persona igual ve el evento.
 * @param fetcher fetch o fetchWithAuth (con sesión, el backend no cuenta al organizador ni a los inscritos)
 */
export async function registrarApertura(fetcher, eventId, origen) {
  try {
    if (visitaDe(eventId)) return;
    const res = await fetcher(`${API_URL}/api/links/abierto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: eventId, origen: origenValido(origen) || "directo" })
    });
    if (!res.ok) return;
    const { visita } = await res.json();
    if (!visita) return;
    const mapa = leer();
    mapa[eventId] = { v: visita, at: Date.now() };
    escribir(mapa);
  } catch {
    // sin conexión o backend dormido: no importa
  }
}
