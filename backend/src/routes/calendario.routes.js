import express from "express";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import Event from "../models/Event.js";
import { calendario } from "../utils/ics.js";

// Suscripción de calendario personal: GET /api/calendario/<token>.ics
// La app de calendario del teléfono (Google, Apple) la consulta cada cierto tiempo, sin sesión:
// por eso el link lleva un código secreto propio de cada persona (User.calendarioToken), que se
// puede cambiar desde el perfil. Trae los eventos en que la persona está inscrita (los cancelados desaparecen).
const router = express.Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const TOKEN_RE = /^[a-f0-9]{48}$/;
const DIA = 24 * 60 * 60 * 1000;

router.get("/:archivo", limiter, async (req, res) => {
  try {
    const token = String(req.params.archivo || "").replace(/\.ics$/i, "");
    if (!TOKEN_RE.test(token)) return res.status(404).type("text").send("No encontrado");
    const user = await User.findOne({ calendarioToken: token }).select("_id activo");
    if (!user || user.activo === false) return res.status(404).type("text").send("No encontrado");

    const eventos = await Event.find({ participants: user._id, date: { $gte: new Date(Date.now() - 7 * DIA) } })
      .select("title date location comuna description lugarTipo")
      .sort({ date: 1 })
      .limit(200)
      .lean();
    res.set("Cache-Control", "private, max-age=900");
    res.type("text/calendar; charset=utf-8").send(calendario(eventos, "Kiu · mis eventos"));
  } catch (err) {
    console.error("Error armando calendario:", err);
    res.status(500).type("text").send("Error");
  }
});

export default router;
