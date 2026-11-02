// Mismos dominios que acepta el backend (backend/src/utils/maps.js)
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

// Link para "Ver en Maps": el que dio el organizador o, si no hay, una búsqueda por nombre y comuna
export const mapsHref = (event) => {
  if (event?.mapsUrl && esLinkDeMaps(event.mapsUrl)) return event.mapsUrl;
  const query = [event?.location, event?.comuna].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};
