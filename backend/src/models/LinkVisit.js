import mongoose from "mongoose";

// Una apertura de un link compartido de un evento, para medir si los links convierten.
// Recorrido: link abierto → cuenta creada (si no tenía) → inscripción. La asistencia sale de
// Event.asistencia (la marca el organizador).
//
// `visita` es un código al azar que queda solo en el navegador de quien abrió el link (localStorage).
// No guarda IP, dispositivo ni nada que identifique a la persona hasta que crea cuenta o se inscribe.
// Al borrar una cuenta, `user` queda en null (ver utils/cuentas.js).
const LinkVisitSchema = new mongoose.Schema({
  visita: { type: String, required: true, unique: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  // De dónde vino el link: "wa", "compartir", "copia", "qr", "directo"...
  origen: { type: String, default: "directo" },
  // Ya tenía sesión iniciada al abrir el link (no necesitaba crear cuenta)
  conSesion: { type: Boolean, default: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  abiertoAt: { type: Date, default: Date.now },
  cuentaCreadaAt: { type: Date, default: null },
  inscritoAt: { type: Date, default: null }
});

LinkVisitSchema.index({ abiertoAt: -1 });
LinkVisitSchema.index({ event: 1, user: 1 });

export default mongoose.model("LinkVisit", LinkVisitSchema);
