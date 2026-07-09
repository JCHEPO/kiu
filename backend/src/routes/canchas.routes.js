import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import Cancha from "../models/Cancha.js";

const router = express.Router();

// GET /api/canchas - Listar todas las canchas (público)
router.get("/", async (req, res) => {
  try {
    const { comuna, tipo, categoria, gratuita } = req.query;
    const filter = {};
    if (comuna) filter.comuna = comuna;
    if (tipo) filter.tipo = tipo;
    if (gratuita !== undefined) filter.gratuita = gratuita === "true";
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

// GET /api/canchas/resolve-url - Resolver link corto de Google Maps y extraer coordenadas
router.get("/resolve-url", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL requerida" });

    const response = await fetch(url, { redirect: "follow" });
    const finalUrl = response.url;

    let lat = null, lng = null;
    const m = finalUrl.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)
           || finalUrl.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/)
           || finalUrl.match(/!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }

    res.json({ url: finalUrl, lat, lng });
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

// POST /api/canchas/bulk - Importar múltiples lugares (solo admin)
router.post("/bulk", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { places } = req.body;
    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: "Se requiere un array 'places'" });
    }
    const results = [];
    for (const place of places) {
      let lat = place.lat ? parseFloat(place.lat) : null;
      let lng = place.lng ? parseFloat(place.lng) : null;
      if (!lat || !lng) {
        try {
          const q = encodeURIComponent(`${place.direccion || place.nombre}, ${place.comuna || ""}, Chile`);
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=cl`,
            { headers: { "User-Agent": "Kiu-App/1.0" } }
          );
          const geoData = await geoRes.json();
          if (geoData.length > 0) { lat = parseFloat(geoData[0].lat); lng = parseFloat(geoData[0].lon); }
        } catch {}
      }
      if (!lat || !lng) { results.push({ nombre: place.nombre, error: "No se pudo geocodificar" }); continue; }
      try {
        const cancha = await Cancha.create({
          nombre: place.nombre,
          ubicacion: { type: "Point", coordinates: [lng, lat] },
          comuna: place.comuna || "",
          direccion: place.direccion || "",
          tipo: place.tipo || [],
          categoria: place.categoria || "cancha",
          gratuita: place.gratuita !== false
        });
        results.push({ nombre: place.nombre, ok: true, id: cancha._id });
      } catch (e) {
        results.push({ nombre: place.nombre, error: e.message });
      }
    }
    res.json({ results, total: places.length, ok: results.filter(r => r.ok).length });
  } catch (err) {
    res.status(500).json({ error: "Error en importación masiva" });
  }
});

// PATCH /api/canchas/:id - Actualizar ubicación de una cancha (solo admin)
router.patch("/:id", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { ubicacion, direccion, comuna } = req.body;
    const update = {};
    if (ubicacion) update.ubicacion = ubicacion;
    if (direccion !== undefined) update.direccion = direccion;
    if (comuna !== undefined) update.comuna = comuna;
    const cancha = await Cancha.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!cancha) return res.status(404).json({ error: "Cancha no encontrada" });
    res.json(cancha);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar cancha" });
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
