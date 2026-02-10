import mongoose from "mongoose";

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String, default: "" },
  location: { type: String, required: true },
  maxParticipants: { type: Number, required: true },
  category: String,
  subcategory: String,
  cost: { type: Number, default: 0 },
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
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Event", EventSchema);
