import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import Cancha from "../models/Cancha.js";

const router = express.Router();

// GET /api/canchas - Listar todas las canchas (público)
router.get("/", async (req, res) => {
  try {
    const { comuna, tipo, categoria } = req.query;
    const filter = {};
    if (comuna) filter.comuna = comuna;
    if (tipo) filter.tipo = tipo;
    if (categoria) {
      const cats = categoria.split(",");
      filter.categoria = cats.length > 1 ? { $in: cats } : cats[0];
    }
    const canchas = await Cancha.find(filter).sort({ createdAt: -1 });
    res.json(canchas);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener canchas" });
  }
});

// GET /api/canchas/resolve-url - Resolver link corto de Google Maps
router.get("/resolve-url", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL requerida" });

    const response = await fetch(url, { redirect: "follow" });
    const finalUrl = response.url;
    res.json({ url: finalUrl });
  } catch (err) {
    res.status(500).json({ error: "No se pudo resolver la URL" });
  }
});

// POST /api/canchas - Crear cancha (solo admin)
router.post("/", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { nombre, ubicacion, comuna, direccion, tipo, categoria, gratuita } = req.body;
    const cancha = await Cancha.create({ nombre, ubicacion, comuna, direccion, tipo, categoria, gratuita });
    res.json(cancha);
  } catch (err) {
    console.error("Error al crear cancha:", err);
    res.status(500).json({ error: "Error al crear cancha", details: err.message });
  }
});

// DELETE /api/canchas/:id - Eliminar cancha (solo admin)
router.delete("/:id", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const cancha = await Cancha.findByIdAndDelete(req.params.id);
    if (!cancha) return res.status(404).json({ error: "Cancha no encontrada" });
    res.json({ message: "Cancha eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar cancha" });
  }
});

export default router;
