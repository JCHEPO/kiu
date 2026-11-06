// Eventos promocionados: la llegada se marca con el código del local (mismas reglas que el backend,
// utils/promocionados.js): desde 1 hora antes hasta 4 horas después del inicio.
export const MIN_ANTES_CHECKIN = 60;
export const HORAS_DESPUES_CHECKIN = 4;

export function ventanaCheckin(date, ahora = Date.now()) {
  const inicio = new Date(date).getTime();
  if (ahora < inicio - MIN_ANTES_CHECKIN * 60 * 1000) return "antes";
  if (ahora > inicio + HORAS_DESPUES_CHECKIN * 60 * 60 * 1000) return "despues";
  return "abierta";
}

export const normalizarCodigo = (c) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

// Link que va en el QR del local. ?o=qr-local cuenta como origen en las métricas de links.
export const linkCheckin = (eventId, codigo) =>
  `${window.location.origin}/event/${eventId}?checkin=${encodeURIComponent(codigo)}&o=qr-local`;

// El código leído del QR se guarda mientras la persona inicia sesión o se inscribe
const clave = (eventId) => `kiu_checkin_${eventId}`;
export function guardarCodigo(eventId, codigo) {
  try { sessionStorage.setItem(clave(eventId), codigo); } catch {}
}
export function leerCodigo(eventId) {
  try { return sessionStorage.getItem(clave(eventId)) || ""; } catch { return ""; }
}
export function borrarCodigo(eventId) {
  try { sessionStorage.removeItem(clave(eventId)); } catch {}
}

export const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-CL")}`;
