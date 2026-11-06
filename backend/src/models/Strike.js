import mongoose from "mongoose";

// Un strike (advertencia). Reglas en utils/strikes.js:
// - inasistencia: lo marca el organizador ("no llegó"); automático.
// - cancelacion_tarde: salir de un evento en cancha reservable a menos de 6 h; automático.
// - conducta: nunca automático, lo da un admin al resolver un reporte.
// Vence a los 90 días. Con 3 activos, suspensión automática (7 días; si se repite, 30).
export const TIPOS_STRIKE = ["inasistencia", "cancelacion_tarde", "conducta"];

const StrikeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
  eventTitulo: { type: String, default: "" }, // por si el evento se borra después
  tipo: { type: String, enum: TIPOS_STRIKE, required: true },
  origen: { type: String, enum: ["organizador", "automatico", "admin"], required: true },
  detalle: { type: String, default: "", maxlength: 300 },
  creadoAt: { type: Date, default: Date.now },
  venceAt: { type: Date, required: true },
  // Anulado: el organizador corrigió la asistencia, el evento "no se jugó" o un admin lo quitó
  anulado: { type: Boolean, default: false },
  anuladoMotivo: { type: String, default: "" },
  // Ya se usó para una suspensión (sigue en el historial, pero no suma para otra)
  suspensionAt: { type: Date, default: null },
  apelacion: {
    texto: { type: String, default: "", maxlength: 500 },
    at: { type: Date, default: null },
    estado: { type: String, enum: ["ninguna", "pendiente", "aceptada", "rechazada"], default: "ninguna" },
    resueltaAt: { type: Date, default: null }
  }
});

StrikeSchema.index({ user: 1, creadoAt: -1 });
StrikeSchema.index({ "apelacion.estado": 1 });

export default mongoose.model("Strike", StrikeSchema);
