// Buscar canchas en OpenStreetMap (OSM) para sumarlas al catálogo.
// OSM es un mapa libre hecho por voluntarios: los datos se pueden usar gratis, con la condición de
// dar crédito ("© colaboradores de OpenStreetMap", licencia ODbL). Por eso cada cancha importada
// guarda fuente "osm" y su id, y la app muestra la atribución.
// Se consulta con Overpass, el buscador público de OSM. Se usa a mano desde el panel admin,
// unas pocas veces: muy por debajo de su límite de uso.

const OVERPASS_URL = () => process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Nombre de cada comuna de Kiu tal como está en OSM (comunas = admin_level 8 en Chile)
const NOMBRE_OSM = {
  "San Pedro": "San Pedro de la Paz"
};

// Caja que encierra el Gran Concepción: evita confundir la comuna con otra del mismo nombre en otro país
export const CAJA_GRAN_CONCE = { sur: -37.35, oeste: -73.35, norte: -36.40, este: -72.55 };

export const dentroDeLaCaja = (lat, lng) =>
  lat >= CAJA_GRAN_CONCE.sur && lat <= CAJA_GRAN_CONCE.norte && lng >= CAJA_GRAN_CONCE.oeste && lng <= CAJA_GRAN_CONCE.este;

const DEPORTES = {
  soccer: "fútbol",
  futsal: "fútbol",
  basketball: "básquet",
  volleyball: "vóley",
  tennis: "tenis",
  padel: "pádel",
  multi: "multiuso"
};

// Superficie (tag surface) en palabras simples
const SUPERFICIES = {
  artificial_turf: "pasto sintético", grass: "pasto", asphalt: "asfalto", concrete: "cemento", paved: "pavimento",
  sand: "arena", dirt: "tierra", ground: "tierra", earth: "tierra", clay: "maicillo", gravel: "ripio", fine_gravel: "maicillo",
  acrylic: "acrílico", tartan: "tartán", rubber: "caucho", wood: "madera"
};

export function consultaOverpass(comuna) {
  const nombre = (NOMBRE_OSM[comuna] || comuna).replace(/"/g, "");
  const { sur, oeste, norte, este } = CAJA_GRAN_CONCE;
  return `[out:json][timeout:25];
area["boundary"="administrative"]["admin_level"="8"]["name"="${nombre}"]->.a;
nwr["leisure"="pitch"]["sport"~"soccer|futsal|basketball|multi"](area.a)(${sur},${oeste},${norte},${este});
out center tags 400;`;
}

// Distancia en metros entre dos puntos (suficiente para detectar duplicados)
export function metros(lat1, lng1, lat2, lng2) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// Un elemento de OSM → propuesta de cancha para el catálogo
export function aPropuesta(el) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const deportes = String(t.sport || "").split(";").map((x) => DEPORTES[x.trim()]).filter(Boolean);
  let tipo = deportes.includes("multiuso") ? ["multiuso"] : [...new Set(deportes)];
  if (!tipo.some((x) => ["fútbol", "básquet", "multiuso"].includes(x))) return null;

  const etiqueta = tipo.includes("multiuso") ? "Multicancha" : tipo.includes("fútbol") ? "Cancha de fútbol" : "Cancha de básquet";
  const nombre = (t.name || "").trim().slice(0, 100);
  const direccion = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ").slice(0, 150);
  const acceso = String(t.access || "").toLowerCase();

  return {
    osmId: `${el.type}/${el.id}`,
    nombre: nombre || etiqueta,
    sinNombre: !nombre,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    tipo,
    direccion,
    // En OSM, lit=yes significa que tiene luz para jugar de noche
    tieneLuz: ["yes", "24/7", "automatic", "limited", "interval"].includes(String(t.lit || "").toLowerCase()),
    luzDesconocida: !t.lit,
    // Con cobro o solo para clientes: casi siempre se reserva
    seReserva: t.fee === "yes" || acceso === "customers",
    // Privada (colegio, club, condominio): normalmente no sirve para un evento abierto
    privada: ["private", "no"].includes(acceso),
    superficie: SUPERFICIES[t.surface] || ""
  };
}

export async function buscarEnOsm(comuna) {
  const res = await fetch(OVERPASS_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Kiu/1.0 (catalogo de canchas)" },
    body: new URLSearchParams({ data: consultaOverpass(comuna) }).toString(),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    const err = new Error(`OpenStreetMap respondió ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const vistas = new Set();
  const propuestas = [];
  for (const el of data.elements || []) {
    const p = aPropuesta(el);
    if (!p || vistas.has(p.osmId) || !dentroDeLaCaja(p.lat, p.lng)) continue;
    vistas.add(p.osmId);
    propuestas.push(p);
  }
  return propuestas;
}
