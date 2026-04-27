import mongoose from "mongoose";

const CanchaSchema = new mongoose.Schema({
  categoria: { type: String, enum: ["cancha", "bar", "cafetería", "tienda", "biblioteca", "plaza"], required: true, default: "cancha" },
  nombre: { type: String, required: true },
  ubicacion: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true } // [longitud, latitud]
  },
  comuna: { type: String, required: true },
  direccion: { type: String, default: "" },
  tipo: { type: [String], enum: ["fútbol", "básquet", "tenis", "pádel", "vóley", "multiuso"], default: [] },
  gratuita: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

CanchaSchema.index({ ubicacion: "2dsphere" });

export default mongoose.model("Cancha", CanchaSchema);
