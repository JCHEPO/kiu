// Links de Google Maps aceptados (para lugares de eventos y para resolver links cortos en el admin).
// Solo https y solo dominios de Google: el servidor visita estos links en /api/canchas/resolve-url,
// así que no puede aceptar cualquier dirección.
const MAPS_HOSTS = [
  "maps.app.goo.gl", "goo.gl",
  "google.com", "www.google.com", "maps.google.com",
  "google.cl", "www.google.cl", "maps.google.cl"
];

export const esLinkDeMaps = (raw) => {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && MAPS_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
};
