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
  // true = uso libre (no se reserva, puede estar ocupada); false = se reserva (cancelar tarde da strike).
  // El nombre del campo viene de antes; en la app se muestra como "Uso libre" / "Se reserva".
  gratuita: { type: Boolean, default: true },
  tieneLuz: { type: Boolean, default: false },
  // De dónde salió el dato. Las importadas de OpenStreetMap guardan su id para no duplicarlas
  // y porque la licencia (ODbL) pide atribución.
  fuente: { type: String, enum: ["manual", "osm"], default: "manual" },
  osmId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

CanchaSchema.index({ ubicacion: "2dsphere" });
CanchaSchema.index({ osmId: 1 }, { unique: true, partialFilterExpression: { osmId: { $type: "string" } } });

// Tipo de lugar para un evento: solo las canchas son "reservable" o "gratuita" (afecta strikes y avisos).
// Cafeterías, bares, etc. quedan como "otro".
export const tipoDeLugar = (c) => {
  if (!c) return "otro";
  if (c.categoria && c.categoria !== "cancha") return "otro";
  return c.gratuita === false ? "reservable" : "gratuita";
};

export default mongoose.model("Cancha", CanchaSchema);
