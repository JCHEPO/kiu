import express from "express";
import mongoose from "mongoose";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import Cancha from "../models/Cancha.js";
import { esLinkDeMaps } from "../utils/maps.js";
import { buscarEnOsm, metros, dentroDeLaCaja } from "../utils/osm.js";

const router = express.Router();

const CATEGORIAS = ["cancha", "bar", "cafetería", "tienda", "biblioteca", "plaza"];
const TIPOS = ["fútbol", "básquet", "tenis", "pádel", "vóley", "multiuso"];

// "Se reserva" es lo contrario de "gratuita" (el nombre del campo viene de antes).
// Acepta cualquiera de las dos formas, para la importación en masa.
const usoLibre = (body, porDefecto = true) => {
  if (typeof body.seReserva === "boolean") return !body.seReserva;
  if (typeof body.gratuita === "boolean") return body.gratuita;
  return porDefecto;
};
const tiposValidos = (t) => Array.isArray(t) ? [...new Set(t.filter((x) => TIPOS.includes(x)))] : [];

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

// Solo links de Google Maps (ver utils/maps.js): esta ruta hace que el servidor visite la URL,
// así que no puede aceptar cualquier dirección (alguien podría usarla para llegar a servicios internos del host).
// GET /api/canchas/resolve-url - Resolver link corto de Google Maps y extraer coordenadas (solo admin)
router.get("/resolve-url", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { url } = req.query;
    if (typeof url !== "string" || !esLinkDeMaps(url)) {
      return res.status(400).json({ error: "Solo se aceptan links de Google Maps (https)" });
    }

    // Seguimos las redirecciones a mano para revisar cada salto: un link corto no puede llevar fuera de Google.
    let finalUrl = url;
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetch(finalUrl, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        const nextUrl = new URL(location, finalUrl).toString();
        if (!esLinkDeMaps(nextUrl)) {
          return res.status(400).json({ error: "El link redirige fuera de Google Maps" });
        }
        finalUrl = nextUrl;
        continue;
      }
      break;
    }

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
    const { nombre, ubicacion, comuna, direccion, tipo, categoria, tieneLuz } = req.body;
    const esCancha = (categoria || "cancha") === "cancha";
    const cancha = await Cancha.create({
      nombre, ubicacion, comuna, direccion, categoria,
      tipo: esCancha ? tiposValidos(tipo) : [],
      gratuita: usoLibre(req.body),
      tieneLuz: esCancha && tieneLuz === true
    });
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
          tipo: tiposValidos(place.tipo),
          categoria: place.categoria || "cancha",
          gratuita: usoLibre(place),
          tieneLuz: place.tieneLuz === true
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

// PATCH /api/canchas/:id - Editar un lugar (solo admin). Cambia solo los campos que vienen.
// No afecta a los eventos ya creados en ese lugar (guardan su tipo al crearse).
router.patch("/:id", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Cancha no encontrada" });
    const { ubicacion, direccion, comuna, nombre, categoria, tipo, tieneLuz } = req.body;
    const update = {};
    if (ubicacion) update.ubicacion = ubicacion;
    if (direccion !== undefined) update.direccion = String(direccion).slice(0, 150);
    if (comuna !== undefined) update.comuna = comuna;
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) return res.status(400).json({ error: "El nombre no puede quedar vacío" });
      update.nombre = nombre.trim().slice(0, 100);
    }
    if (categoria !== undefined) {
      if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ error: "Tipo de lugar inválido" });
      update.categoria = categoria;
      if (categoria !== "cancha") { update.tipo = []; update.tieneLuz = false; }
    }
    if (tipo !== undefined && update.tipo === undefined) update.tipo = tiposValidos(tipo);
    if (typeof tieneLuz === "boolean" && update.tieneLuz === undefined) update.tieneLuz = tieneLuz;
    if (typeof req.body.seReserva === "boolean" || typeof req.body.gratuita === "boolean") update.gratuita = usoLibre(req.body);
    const cancha = await Cancha.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!cancha) return res.status(404).json({ error: "Cancha no encontrada" });
    res.json(cancha);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar cancha" });
  }
});

// GET /api/canchas/osm?comuna=Concepción - Canchas de fútbol, básquet o multicanchas que OpenStreetMap
// tiene en esa comuna, para revisarlas antes de importar (solo admin). Marca las que ya están en el catálogo.
router.get("/osm", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const comuna = typeof req.query.comuna === "string" ? req.query.comuna.trim() : "";
    if (!comuna || comuna.length > 60) return res.status(400).json({ error: "Elige una comuna" });
    const propuestas = await buscarEnOsm(comuna);
    const existentes = await Cancha.find({ categoria: "cancha" }).select("nombre ubicacion osmId").lean();
    const porOsm = new Set(existentes.map((c) => c.osmId).filter(Boolean));
    const lugares = propuestas.map((p) => {
      let cercana = null;
      for (const c of existentes) {
        const [lng, lat] = c.ubicacion?.coordinates || [];
        if (typeof lat !== "number") continue;
        const d = metros(p.lat, p.lng, lat, lng);
        if (d < 80 && (!cercana || d < cercana.metros)) cercana = { nombre: c.nombre, metros: Math.round(d) };
      }
      return { ...p, comuna, yaImportada: porOsm.has(p.osmId), cercana };
    });
    // Primero las que tienen nombre (suelen ser las conocidas)
    lugares.sort((a, b) => Number(a.sinNombre) - Number(b.sinNombre) || a.nombre.localeCompare(b.nombre));
    res.json({ comuna, total: lugares.length, lugares });
  } catch (err) {
    console.error("Error consultando OpenStreetMap:", err.message);
    const ocupado = err.status === 429 || err.status === 504 || err.name === "TimeoutError";
    res.status(502).json({ error: ocupado ? "OpenStreetMap está ocupado. Prueba de nuevo en un minuto." : "No se pudo consultar OpenStreetMap" });
  }
});

// POST /api/canchas/osm/importar { lugares: [{ osmId, nombre, lat, lng, comuna, tipo, tieneLuz, seReserva, direccion }] }
// Importa las canchas elegidas (solo admin). Si una ya estaba (mismo id de OSM), se salta.
router.post("/osm/importar", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { lugares } = req.body || {};
    if (!Array.isArray(lugares) || lugares.length === 0) return res.status(400).json({ error: "No elegiste canchas" });
    if (lugares.length > 300) return res.status(400).json({ error: "Máximo 300 canchas por vez" });
    const resultados = [];
    for (const l of lugares) {
      const nombre = typeof l?.nombre === "string" ? l.nombre.trim().slice(0, 100) : "";
      const lat = Number(l?.lat), lng = Number(l?.lng);
      const osmId = typeof l?.osmId === "string" && /^(node|way|relation)\/\d+$/.test(l.osmId) ? l.osmId : null;
      if (!nombre || !osmId || !dentroDeLaCaja(lat, lng) || typeof l?.comuna !== "string" || !l.comuna.trim()) {
        resultados.push({ osmId: l?.osmId, nombre, error: "Datos incompletos" });
        continue;
      }
      try {
        const c = await Cancha.create({
          categoria: "cancha",
          nombre,
          ubicacion: { type: "Point", coordinates: [lng, lat] },
          comuna: l.comuna.trim().slice(0, 60),
          direccion: typeof l.direccion === "string" ? l.direccion.slice(0, 150) : "",
          tipo: tiposValidos(l.tipo),
          gratuita: l.seReserva !== true,
          tieneLuz: l.tieneLuz === true,
          fuente: "osm",
          osmId
        });
        resultados.push({ osmId, nombre, ok: true, id: c._id });
      } catch (e) {
        resultados.push({ osmId, nombre, error: e.code === 11000 ? "Ya estaba en el catálogo" : e.message });
      }
    }
    res.json({ resultados, total: lugares.length, ok: resultados.filter((r) => r.ok).length });
  } catch (err) {
    console.error("Error importando de OpenStreetMap:", err);
    res.status(500).json({ error: "Error al importar" });
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
