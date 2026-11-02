import Activity from "../models/Activity.js";

// Anota una acción para las métricas. No espera ni lanza: si falla, la acción del usuario ya se hizo igual.
export function registrarActividad(tipo, { user = null, event = null, via = "" } = {}) {
  Activity.create({ tipo, user, event, via }).catch((err) => console.error("Error registrando actividad:", err.message));
}
