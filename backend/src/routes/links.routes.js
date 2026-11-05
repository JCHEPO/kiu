import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { optionalAuth } from "../middleware/auth.middleware.js";
import Event from "../models/Event.js";
import { registrarApertura } from "../utils/seguimiento.js";

const router = express.Router();

const aperturaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

// POST /api/links/abierto  { event, origen } → { visita }
// La llama el frontend cuando alguien llega a un evento desde un link (ver frontend/src/utils/seguimiento.js).
// No se cuenta al organizador ni a quien ya está inscrito (abren su propio evento todo el tiempo).
router.post("/abierto", aperturaLimiter, optionalAuth, async (req, res) => {
  try {
    const { event: eventId, origen } = req.body || {};
    if (!mongoose.isValidObjectId(eventId)) return res.status(400).json({ error: "Evento inválido" });
    const event = await Event.findById(eventId).select("creator participants").lean();
    if (!event) return res.status(404).json({ error: "Evento no encontrado" });

    const userId = req.user?.id || null;
    if (userId) {
      const esCreador = String(event.creator) === String(userId);
      const inscrito = (event.participants || []).some((p) => String(p) === String(userId));
      if (esCreador || inscrito) return res.json({ visita: null });
    }

    const visita = await registrarApertura({ eventId, origen, userId });
    res.json({ visita });
  } catch (err) {
    console.error("Error registrando apertura de link:", err);
    res.status(500).json({ error: "Error al registrar el link" });
  }
});

export default router;
