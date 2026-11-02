// Regiones y comunas donde funciona Kiu.
// Solo las activas se pueden elegir. Para abrir una ciudad nueva: cargar sus comunas y marcarla activa.
export const REGIONES = [
  { nombre: "Gran Concepción", activa: true, comunas: ["Concepción", "Talcahuano", "Chiguayante", "San Pedro", "Hualpén", "Penco", "Tomé", "Coronel"] },
  { nombre: "Chillán", activa: false, comunas: ["Chillán", "Chillán Viejo"] },
  { nombre: "Región Metropolitana", activa: false, comunas: [] }
];

// Comunas de todas las regiones activas (para elegir dónde es un "Otro lugar")
export const comunasActivas = () => REGIONES.filter(r => r.activa).flatMap(r => r.comunas);
