import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // Opcional: un aviso de evento cancelado queda sin evento (ya se borró)
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Notification", NotificationSchema);
