// Actividades que se pueden crear. El piloto parte con fútbol y básquet en Gran Concepción
// (contexto del proyecto). Para abrir otra, agregarla a la lista; los eventos que ya existen no cambian.
export const TIPOS_ACTIVOS = ["Partido de futbol"];            // también: "Juegos de mesa", "Evento"
export const DEPORTES_ACTIVOS = ["Futbol", "Básquet"];         // también: "Voleyball", "Handball", "Tenis", "Padel"

// Formatos por deporte
export const FORMATOS = {
  Futbol: ["5vs5", "7vs7", "11vs11"],
  Voleyball: ["2vs2", "4vs4", "6vs6"],
  Handball: ["5vs5"],
  Tenis: ["1vs1", "2vs2"],
  Padel: ["1vs1", "2vs2"],
  Básquet: ["1vs1", "2vs2", "3vs3", "5vs5"]
};

// Tipo de cancha del catálogo (admin → Lugares) que sirve para cada deporte. Las "multiuso" sirven para todos.
export const TIPO_CANCHA = {
  Futbol: "fútbol",
  Básquet: "básquet",
  Voleyball: "vóley",
  Tenis: "tenis",
  Padel: "pádel"
};

// Deportes que necesitan pelota (se agrega "Pelota" a ¿qué llevamos?)
export const CON_PELOTA = ["Futbol", "Voleyball", "Handball", "Básquet"];
