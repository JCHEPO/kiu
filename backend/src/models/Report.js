import mongoose from "mongoose";

export const MOTIVOS_REPORTE = ["acoso o insultos", "spam o publicidad", "contenido inapropiado", "datos falsos", "no se presentó", "otro"];

// Reporte de un usuario o de un evento. Lo revisa un admin en el panel.
const ReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null si quien reportó borró su cuenta
  tipo: { type: String, enum: ["usuario", "evento"], required: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  targetEvent: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
  targetTitulo: { type: String, default: "" }, // nombre del evento o del usuario al momento de reportar (por si después se borra)
  motivo: { type: String, enum: MOTIVOS_REPORTE, required: true },
  detalle: { type: String, default: "", maxlength: 500 },
  estado: { type: String, enum: ["pendiente", "resuelto", "descartado"], default: "pendiente" },
  resueltoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resueltoAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

ReportSchema.index({ estado: 1, createdAt: -1 });

export default mongoose.model("Report", ReportSchema);
