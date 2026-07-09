import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import Event from "../models/Event.js";

const router = express.Router();
const adminOnly = (req, res, next) => authenticate(req, res, () => authorize(["admin"])(req, res, next));

// GET /api/admin/users
router.get("/users", adminOnly, async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password -resetToken -resetTokenExpiry")
      .sort({ fechaRegistro: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// PATCH /api/admin/users/:id
router.patch("/users/:id", adminOnly, async (req, res) => {
  try {
    const { activo, verificado, solicitaVerificacion, strikes } = req.body;
    const update = {};
    if (activo !== undefined) update.activo = activo;
    if (verificado !== undefined) update.verificado = verificado;
    if (solicitaVerificacion !== undefined) update.solicitaVerificacion = solicitaVerificacion;
    if (strikes !== undefined) update.strikes = parseInt(strikes);
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select("-password -resetToken -resetTokenExpiry");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// GET /api/admin/events
router.get("/events", adminOnly, async (req, res) => {
  try {
    const events = await Event.find({})
      .populate("creator", "nombre email")
      .select("title category date location maxParticipants participants manualParticipants creator createdAt")
      .sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// DELETE /api/admin/events/:id
router.delete("/events/:id", adminOnly, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Evento eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar evento" });
  }
});

// GET /api/admin/verificaciones - users who requested verification
router.get("/verificaciones", adminOnly, async (req, res) => {
  try {
    const users = await User.find({ solicitaVerificacion: true })
      .select("-password -resetToken -resetTokenExpiry")
      .sort({ fechaRegistro: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener verificaciones" });
  }
});

export default router;
