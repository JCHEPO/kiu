import mongoose from "mongoose";

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String, default: "" },
  location: { type: String, required: true },
  mapsUrl: { type: String, default: "" }, // link de Google Maps del lugar (opcional, para "Otro lugar")
  minParticipants: { type: Number },
  maxParticipants: { type: Number, required: true },
  category: String,
  subcategory: String,
  cost: { type: Number, default: 0 },
  comuna: { type: String, default: "" },
  restriccionGenero: { type: String, enum: ["Solo hombres", "Solo mujeres", "Mixto"], default: "Mixto" },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  manualParticipants: [{ type: String }],
  items: [{
    name: { type: String, required: true },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  }],
  // Avisos ya enviados (para no repetirlos)
  confirmedAt: { type: Date, default: null },     // se llegó al mínimo de participantes
  reminderSentAt: { type: Date, default: null },  // recordatorio antes del evento
  createdAt: { type: Date, default: Date.now }
});

EventSchema.index({ date: 1 });

export default mongoose.model("Event", EventSchema);
