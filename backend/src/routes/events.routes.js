import express from "express";
import mongoose from "mongoose";
import { authenticate, authorize, optionalAuth } from "../middleware/auth.middleware.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { esLinkDeMaps } from "../utils/maps.js";
import { notify, formatFechaHora, totalParticipantes } from "../utils/notify.js";
import { registrarActividad } from "../utils/actividad.js";

const router = express.Router();

// Datos de un usuario que se muestran dentro de un evento. Nunca el email:
// la lista de eventos es pública y cualquier participante vería los correos de los demás.
const USER_PUBLIC = "nombre apellido";

const findEventFull = (id) => Event.findById(id)
  .populate("creator", USER_PUBLIC)
  .populate("participants", USER_PUBLIC)
  .populate("messages.sender", USER_PUBLIC)
  .populate("items.claimedBy", USER_PUBLIC);

// Vista de un evento para quien no inició sesión: lo necesario para decidir si unirse,
// sin nombres de participantes, muro ni lista de ítems.
const toPublicEvent = (event) => {
  const e = event.toObject();
  return {
    _id: e._id,
    title: e.title,
    date: e.date,
    description: e.description,
    location: e.location,
    mapsUrl: e.mapsUrl || "",
    comuna: e.comuna,
    minParticipants: e.minParticipants,
    maxParticipants: e.maxParticipants,
    category: e.category,
    subcategory: e.subcategory,
    cost: e.cost,
    restriccionGenero: e.restriccionGenero,
    creator: e.creator ? { _id: e.creator._id, nombre: e.creator.nombre || "" } : null,
    participantCount: totalParticipantes(e),
    isPublicView: true
  };
};

// Si el evento acaba de llegar al mínimo de participantes, avisar a todos una sola vez.
// Marca event.confirmedAt; hay que llamarlo antes de event.save().
const marcarSiSeConfirma = (event) => {
  if (!event.minParticipants || event.confirmedAt) return false;
  if (totalParticipantes(event) < event.minParticipants) return false;
  event.confirmedAt = new Date();
  return true;
};

const avisarConfirmado = (io, event) => notify(io, {
  userIds: [event.creator, ...event.participants],
  event,
  message: `¡"${event.title}" está confirmado! Ya son ${totalParticipantes(event)}.`,
  email: {
    subject: `Confirmado: ${event.title}`,
    text: `"${event.title}" llegó al mínimo de participantes y está confirmado.\nCuándo: ${formatFechaHora(event.date)}\nDónde: ${event.location}`
  }
});

// GET /api/events - Lista de eventos futuros, paginada (público, con filtro opcional por género)
// Query: ?page=1&limit=50&genero=Hombre — responde { events, total, page, pages }
router.get("/", async (req, res) => {
  try {
    const { genero } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    let filter = { date: { $gte: new Date() } };

    if (genero) {
      if (genero === "Hombre") {
        filter.$or = [
          { restriccionGenero: { $in: ["Solo hombres", "Mixto"] } },
          { restriccionGenero: { $exists: false } }
        ];
      } else if (genero === "Mujer") {
        filter.$or = [
          { restriccionGenero: { $in: ["Solo mujeres", "Mixto"] } },
          { restriccionGenero: { $exists: false } }
        ];
      } else {
        // LGTBQ+ u otro: solo Mixto
        filter.$or = [
          { restriccionGenero: "Mixto" },
          { restriccionGenero: { $exists: false } }
        ];
      }
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate("creator", USER_PUBLIC)
        .sort({ date: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter)
    ]);
    res.json({ events, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// GET /api/events/mine - Eventos donde soy creador o participante (autenticado)
// IMPORTANTE: debe declararse antes de GET /:id para que "mine" no se interprete como id
router.get("/mine", authenticate, async (req, res) => {
  try {
    const events = await Event.find({
      $or: [{ creator: req.user.id }, { participants: req.user.id }]
    })
      .populate("creator", USER_PUBLIC)
      .sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error("Error al obtener mis eventos:", err);
    res.status(500).json({ error: "Error al obtener tus eventos" });
  }
});

// POST /api/events - Crear evento (todos los usuarios logueados)
router.post("/", authenticate, async (req, res) => {
  const { title, date, description, location, mapsUrl, minParticipants, maxParticipants, category, subcategory, cost, restriccionGenero, comuna, items } = req.body;
  try {
    // --- Validación server-side ---
    if (typeof title !== "string" || !title.trim())
      return res.status(400).json({ error: "El título es obligatorio" });
    if (title.trim().length > 100)
      return res.status(400).json({ error: "El título es demasiado largo (máx 100 caracteres)" });
    if (typeof location !== "string" || !location.trim())
      return res.status(400).json({ error: "El lugar es obligatorio" });

    const dateObj = new Date(date);
    if (!date || isNaN(dateObj.getTime()))
      return res.status(400).json({ error: "Fecha inválida" });
    if (dateObj.getTime() < Date.now() - 15 * 60 * 1000)
      return res.status(400).json({ error: "La fecha del evento ya pasó" });

    const max = parseInt(maxParticipants);
    if (!Number.isInteger(max) || max < 2 || max > 1000)
      return res.status(400).json({ error: "El máximo de participantes debe ser un número entre 2 y 1000" });

    let min;
    if (minParticipants !== undefined && minParticipants !== null && minParticipants !== "") {
      min = parseInt(minParticipants);
      if (!Number.isInteger(min) || min < 1)
        return res.status(400).json({ error: "El mínimo de participantes es inválido" });
      if (min > max)
        return res.status(400).json({ error: "El mínimo de participantes no puede ser mayor que el máximo" });
    }

    const costNum = Number(cost) || 0;
    if (costNum < 0)
      return res.status(400).json({ error: "El costo no puede ser negativo" });
    if (restriccionGenero && !["Solo hombres", "Solo mujeres", "Mixto"].includes(restriccionGenero))
      return res.status(400).json({ error: "Restricción de género inválida" });
    if (location.trim().length > 200)
      return res.status(400).json({ error: "El nombre del lugar es demasiado largo" });
    if (mapsUrl && (typeof mapsUrl !== "string" || !esLinkDeMaps(mapsUrl.trim())))
      return res.status(400).json({ error: "El link del lugar debe ser de Google Maps" });

    const initialItems = Array.isArray(items)
      ? items.filter(i => i && typeof i.name === "string" && i.name.trim()).map(i => ({ name: i.name.trim().slice(0, 100) }))
      : [];
    const event = await Event.create({
      title: title.trim(),
      date: dateObj,
      description: typeof description === "string" ? description.slice(0, 500) : "",
      location: location.trim(),
      mapsUrl: mapsUrl ? mapsUrl.trim() : "",
      minParticipants: min,
      maxParticipants: max,
      category,
      subcategory,
      cost: costNum,
      comuna: typeof comuna === "string" ? comuna.trim().slice(0, 60) : "",
      restriccionGenero: restriccionGenero || "Mixto",
      creator: req.user.id,
      participants: [req.user.id],
      messages: [],
      items: initialItems
    });
    res.json(event);
    registrarActividad("evento_creado", { user: req.user.id, event: event._id });
  } catch (err) {
    console.error("Error al crear evento:", err);
    res.status(500).json({ error: "Error al crear evento", details: err.message });
  }
});

// GET /api/events/:id - Obtener evento específico (público)
// Con sesión: el detalle completo. Sin sesión: la vista pública (sin nombres, muro ni ítems).
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }
    const event = await findEventFull(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (!req.user) {
      registrarActividad("vista_publica", { event: event._id });
      return res.json(toPublicEvent(event));
    }
    res.json(event);
  } catch (err) {
    console.error("Error al obtener evento:", err);
    res.status(500).json({ error: "Error al obtener evento" });
  }
});

// DELETE /api/events/:id - Eliminar evento (solo creador)
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (event.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para eliminar este evento" });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Evento eliminado exitosamente" });

    // Avisar a los inscritos (menos al creador) que el evento se canceló.
    // El aviso queda sin evento asociado porque ya no existe.
    if (new Date(event.date).getTime() > Date.now()) {
      const cuando = formatFechaHora(event.date);
      notify(req.app.get("io"), {
        userIds: event.participants.filter(p => p.toString() !== req.user.id),
        event: null,
        message: `Se canceló "${event.title}" (${cuando})`,
        email: {
          subject: `Cancelado: ${event.title}`,
          text: `El organizador canceló "${event.title}", que era el ${formatFechaHora(event.date, " a las ")} en ${event.location}.`
        }
      });
    }
  } catch (err) {
    console.error("Error al eliminar evento:", err);
    res.status(500).json({ error: "Error al eliminar evento" });
  }
});

// POST /api/events/:id/join - Unirse a un evento
router.post("/:id/join", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    // Validar restricción de género
    const user = await User.findById(req.user.id);
    if (event.restriccionGenero !== "Mixto" && event.restriccionGenero && !user.genero) {
      return res.status(403).json({ error: "Este evento tiene restricción de género. Indica tu género en tu perfil para unirte." });
    }
    if (event.restriccionGenero === "Solo hombres" && user.genero !== "Hombre") {
      return res.status(403).json({ error: "Este evento es solo para hombres" });
    }
    if (event.restriccionGenero === "Solo mujeres" && user.genero !== "Mujer") {
      return res.status(403).json({ error: "Este evento es solo para mujeres" });
    }

    if (event.participants.includes(req.user.id)) {
      return res.status(400).json({ error: "Ya estás en este evento" });
    }

    // El cupo incluye a los participantes agregados a mano por el creador
    const totalParticipants = event.participants.length + (event.manualParticipants?.length || 0);
    if (totalParticipants >= event.maxParticipants) {
      return res.status(400).json({ error: "Evento lleno" });
    }

    event.participants.push(req.user.id);
    const seConfirma = marcarSiSeConfirma(event);
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    const io = req.app.get("io");
    io.to(`event-${req.params.id}`).emit("event-updated", updatedEvent);

    registrarActividad("union", { user: req.user.id, event: event._id, via: req.body?.via === "vista_publica" ? "vista_publica" : "" });

    // Avisos (después de responder; si fallan, la persona ya quedó inscrita)
    if (event.creator.toString() !== req.user.id) {
      notify(io, {
        userIds: [event.creator],
        event,
        message: `${user.nombre || "Alguien"} se unió a "${event.title}" (${totalParticipantes(event)}/${event.maxParticipants})`
      });
    }
    if (seConfirma) avisarConfirmado(io, event);
  } catch (err) {
    console.error("Error al unirse al evento:", err);
    res.status(500).json({ error: "Error al unirse al evento" });
  }
});

// POST /api/events/:id/leave - Salir de un evento
router.post("/:id/leave", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (event.creator.toString() === req.user.id) {
      return res.status(400).json({ error: "El creador no puede salir del evento" });
    }

    event.participants = event.participants.filter(p => p.toString() !== req.user.id);
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
    registrarActividad("salida", { user: req.user.id, event: req.params.id });
  } catch (err) {
    console.error("Error al salir del evento:", err);
    res.status(500).json({ error: "Error al salir del evento" });
  }
});

// POST /api/events/:id/messages - Agregar mensaje al muro
router.post("/:id/messages", authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string" || !text.trim())
      return res.status(400).json({ error: "El mensaje no puede estar vacío" });
    if (text.length > 500)
      return res.status(400).json({ error: "El mensaje es demasiado largo (máx 500 caracteres)" });
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    event.messages.push({
      sender: req.user.id,
      text: text.trim(),
      createdAt: new Date()
    });

    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al agregar mensaje:", err);
    res.status(500).json({ error: "Error al agregar mensaje" });
  }
});

// POST /api/events/:id/items - Agregar item a la lista
router.post("/:id/items", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ error: "El nombre del item no puede estar vacío" });
    if (name.length > 100)
      return res.status(400).json({ error: "El nombre del item es demasiado largo" });
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const isParticipant = event.participants.some(p => p.toString() === req.user.id);
    const isCreator = event.creator.toString() === req.user.id;

    if (!isParticipant && !isCreator) {
      return res.status(403).json({ error: "Debes ser participante para agregar items" });
    }

    event.items.push({ name: name.trim(), claimedBy: null });
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al agregar item:", err);
    res.status(500).json({ error: "Error al agregar item" });
  }
});

// POST /api/events/:id/items/:itemId/claim - Reclamar un item
router.post("/:id/items/:itemId/claim", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const item = event.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    const isParticipant = event.participants.some(p => p.toString() === req.user.id);
    const isCreator = event.creator.toString() === req.user.id;
    if (!isParticipant && !isCreator) {
      return res.status(403).json({ error: "Debes ser participante para llevar un item" });
    }

    if (item.claimedBy) {
      return res.status(400).json({ error: "Item ya reclamado" });
    }

    item.claimedBy = req.user.id;
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al reclamar item:", err);
    res.status(500).json({ error: "Error al reclamar item" });
  }
});

// PUT /api/events/:id - Editar evento (solo creador)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (event.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para editar este evento" });
    }

    const { location, date, comuna, mapsUrl } = req.body;
    const changes = [];

    // --- Validación (antes de tocar el evento) ---
    if (location !== undefined && (typeof location !== "string" || !location.trim() || location.trim().length > 200)) {
      return res.status(400).json({ error: "Lugar inválido" });
    }
    if (comuna !== undefined && (typeof comuna !== "string" || comuna.trim().length > 60)) {
      return res.status(400).json({ error: "Comuna inválida" });
    }
    if (mapsUrl !== undefined && mapsUrl !== "" && (typeof mapsUrl !== "string" || !esLinkDeMaps(mapsUrl.trim()))) {
      return res.status(400).json({ error: "El link del lugar debe ser de Google Maps" });
    }

    let newDate = null;
    if (date) {
      const hoursUntilEvent = (new Date(event.date) - new Date()) / (1000 * 60 * 60);
      if (hoursUntilEvent < 24) {
        return res.status(400).json({ error: "No se puede modificar la fecha/hora a menos de 24 horas del evento" });
      }
      newDate = new Date(date);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({ error: "Fecha inválida" });
      }
      if (newDate.getTime() < Date.now()) {
        return res.status(400).json({ error: "La nueva fecha ya pasó" });
      }
    }

    // --- Aplicar cambios ---
    if (location && location.trim() !== event.location) {
      event.location = location.trim();
      // El link de Maps era del lugar anterior: se reemplaza o se borra
      event.mapsUrl = typeof mapsUrl === "string" ? mapsUrl.trim() : "";
      if (typeof comuna === "string") event.comuna = comuna.trim();
      changes.push("lugar");
    }

    if (newDate && newDate.getTime() !== new Date(event.date).getTime()) {
      event.date = newDate;
      changes.push("fecha/hora");
    }

    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);

    // Avisar a los participantes de la app (excepto al creador): en la app y por email
    if (changes.length > 0) {
      const changeText = changes.join(" y ");
      notify(req.app.get("io"), {
        userIds: event.participants.filter(p => p.toString() !== req.user.id),
        event,
        message: `Se actualizó ${changeText} del evento "${event.title}"`,
        email: {
          subject: `Cambió ${changeText}: ${event.title}`,
          text: `El organizador cambió ${changeText} de "${event.title}".\nCuándo: ${formatFechaHora(event.date)}\nDónde: ${event.location}`
        }
      });
    }
  } catch (err) {
    console.error("Error al editar evento:", err);
    res.status(500).json({ error: "Error al editar evento" });
  }
});

// POST /api/events/:id/manual-participants - Agregar participante manual (solo creador)
router.post("/:id/manual-participants", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ error: "El nombre no puede estar vacío" });
    if (name.length > 60)
      return res.status(400).json({ error: "El nombre es demasiado largo" });
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (event.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: "Solo el creador puede agregar participantes manuales" });
    }

    const totalParticipants = (event.participants?.length || 0) + (event.manualParticipants?.length || 0);
    if (totalParticipants >= event.maxParticipants) {
      return res.status(400).json({ error: "Evento lleno" });
    }

    event.manualParticipants.push(name.trim());
    const seConfirma = marcarSiSeConfirma(event);
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
    if (seConfirma) avisarConfirmado(req.app.get("io"), event);
  } catch (err) {
    console.error("Error al agregar participante manual:", err);
    res.status(500).json({ error: "Error al agregar participante manual" });
  }
});

// DELETE /api/events/:id/manual-participants/:index - Remover participante manual (solo creador)
router.delete("/:id/manual-participants/:index", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (event.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: "Solo el creador puede remover participantes manuales" });
    }

    const index = parseInt(req.params.index);
    if (index < 0 || index >= event.manualParticipants.length) {
      return res.status(400).json({ error: "Índice inválido" });
    }

    event.manualParticipants.splice(index, 1);
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    req.app.get("io").to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al remover participante manual:", err);
    res.status(500).json({ error: "Error al remover participante manual" });
  }
});

export default router;
