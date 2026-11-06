import mongoose from "mongoose";

// Registro mínimo de actividad para las métricas del piloto (panel admin → Métricas).
// Es propio: no usa cookies ni servicios externos. Al borrar una cuenta, `user` queda en null.
export const TIPOS_ACTIVIDAD = ["registro", "evento_creado", "union", "salida", "vista_publica", "checkin"];

const ActivitySchema = new mongoose.Schema({
  tipo: { type: String, enum: TIPOS_ACTIVIDAD, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
  via: { type: String, default: "" }, // "vista_publica" si se unió después de ver el evento sin cuenta
  at: { type: Date, default: Date.now }
});

ActivitySchema.index({ tipo: 1, at: -1 });

export default mongoose.model("Activity", ActivitySchema);
