import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth.middleware.js";
import Report, { MOTIVOS_REPORTE } from "../models/Report.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import { notify } from "../utils/notify.js";

const router = express.Router();

// Máximo 10 reportes por hora por usuario (evita usar los reportes para acosar o llenar el panel)
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Enviaste muchos reportes seguidos. Prueba más tarde." }
});

// POST /api/reports - reportar un usuario o un evento
// Body: { tipo: "usuario" | "evento", id, motivo, detalle? }
router.post("/", authenticate, reportLimiter, async (req, res) => {
  try {
    const { tipo, id, motivo, detalle } = req.body || {};
    if (!["usuario", "evento"].includes(tipo)) return res.status(400).json({ error: "Tipo de reporte inválido" });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "No encontramos lo que quieres reportar" });
    if (!MOTIVOS_REPORTE.includes(motivo)) return res.status(400).json({ error: "Elige un motivo" });
    if (detalle !== undefined && (typeof detalle !== "string" || detalle.length > 500))
      return res.status(400).json({ error: "El detalle es demasiado largo (máx 500 caracteres)" });

    let targetUser = null, targetEvent = null, targetTitulo = "";
    if (tipo === "usuario") {
      if (String(id) === String(req.user.id)) return res.status(400).json({ error: "No puedes reportarte a ti mismo" });
      const u = await User.findById(id).select("nombre apellido");
      if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
      targetUser = u._id;
      targetTitulo = [u.nombre, u.apellido].filter(Boolean).join(" ");
    } else {
      const e = await Event.findById(id).select("title creator");
      if (!e) return res.status(404).json({ error: "Evento no encontrado" });
      if (String(e.creator) === String(req.user.id)) return res.status(400).json({ error: "No puedes reportar tu propio evento" });
      targetEvent = e._id;
      targetUser = e.creator; // el responsable del evento
      targetTitulo = e.title;
    }

    // Un solo reporte pendiente por persona y por objetivo
    const filtroDuplicado = tipo === "usuario"
      ? { reporter: req.user.id, tipo, targetUser, estado: "pendiente" }
      : { reporter: req.user.id, tipo, targetEvent, estado: "pendiente" };
    if (await Report.findOne(filtroDuplicado)) {
      return res.json({ message: "Ya habías enviado este reporte. Lo estamos revisando." });
    }

    await Report.create({
      reporter: req.user.id, tipo, targetUser, targetEvent, targetTitulo, motivo,
      detalle: typeof detalle === "string" ? detalle.trim() : ""
    });
    res.json({ message: "Gracias. Revisaremos tu reporte." });

    // Aviso en la app a los admins
    const admins = await User.find({ rol: "admin" }).select("_id");
    notify(req.app.get("io"), {
      userIds: admins.map((a) => a._id),
      event: null,
      message: `Nuevo reporte de ${tipo}: "${targetTitulo || "sin nombre"}" (${motivo})`
    });
  } catch (err) {
    console.error("Error al crear reporte:", err);
    res.status(500).json({ error: "Error al enviar el reporte" });
  }
});

export default router;
