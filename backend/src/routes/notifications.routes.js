import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// GET /api/notifications - Obtener notificaciones del usuario
router.get("/", authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate("event", "title")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    console.error("Error al obtener notificaciones:", err);
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
});

// PUT /api/notifications/:id/read - Marcar como leída
router.put("/:id/read", authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar notificación" });
  }
});

// PUT /api/notifications/read-all - Marcar todas como leídas
router.put("/read-all", authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    res.json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar notificaciones" });
  }
});

export default router;
