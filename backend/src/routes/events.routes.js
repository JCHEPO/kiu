import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// GET /api/events - Lista de eventos (público, con filtro opcional por género)
router.get("/", async (req, res) => {
  try {
    const { genero } = req.query;
    let filter = {};

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

    const events = await Event.find(filter).populate("creator", "email nombre apellido");
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// POST /api/events - Crear evento (todos los usuarios logueados)
router.post("/", authenticate, async (req, res) => {
  const { title, date, description, location, maxParticipants, category, subcategory, cost, restriccionGenero } = req.body;
  try {
    const event = await Event.create({
      title,
      date,
      description,
      location,
      maxParticipants,
      category,
      subcategory,
      cost: cost || 0,
      restriccionGenero: restriccionGenero || "Mixto",
      creator: req.user.id,
      participants: [req.user.id],
      messages: [],
      items: []
    });
    res.json(event);
  } catch (err) {
    console.error("Error al crear evento:", err);
    res.status(500).json({ error: "Error al crear evento", details: err.message });
  }
});

// GET /api/events/:id - Obtener evento específico con detalles
router.get("/:id", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
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
    if (event.restriccionGenero === "Solo hombres" && user.genero !== "Hombre") {
      return res.status(403).json({ error: "Este evento es solo para hombres" });
    }
    if (event.restriccionGenero === "Solo mujeres" && user.genero !== "Mujer") {
      return res.status(403).json({ error: "Este evento es solo para mujeres" });
    }

    if (event.participants.includes(req.user.id)) {
      return res.status(400).json({ error: "Ya estás en este evento" });
    }

    if (event.participants.length >= event.maxParticipants) {
      return res.status(400).json({ error: "Evento lleno" });
    }

    event.participants.push(req.user.id);
    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
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

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al salir del evento:", err);
    res.status(500).json({ error: "Error al salir del evento" });
  }
});

// POST /api/events/:id/messages - Agregar mensaje al muro
router.post("/:id/messages", authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    event.messages.push({
      sender: req.user.id,
      text,
      createdAt: new Date()
    });

    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al agregar mensaje:", err);
    res.status(500).json({ error: "Error al agregar mensaje" });
  }
});

// POST /api/events/:id/items - Agregar item a la lista
router.post("/:id/items", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const isParticipant = event.participants.some(p => p.toString() === req.user.id);
    const isCreator = event.creator.toString() === req.user.id;

    if (!isParticipant && !isCreator) {
      return res.status(403).json({ error: "Debes ser participante para agregar items" });
    }

    event.items.push({ name, claimedBy: null });
    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
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

    if (item.claimedBy) {
      return res.status(400).json({ error: "Item ya reclamado" });
    }

    item.claimedBy = req.user.id;
    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
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

    const { location, date } = req.body;
    const changes = [];

    if (location && location !== event.location) {
      event.location = location;
      changes.push("lugar");
    }

    if (date) {
      const now = new Date();
      const eventDate = new Date(event.date);
      const hoursUntilEvent = (eventDate - now) / (1000 * 60 * 60);

      if (hoursUntilEvent < 24) {
        return res.status(400).json({ error: "No se puede modificar la fecha/hora a menos de 24 horas del evento" });
      }

      event.date = new Date(date);
      changes.push("fecha/hora");
    }

    await event.save();

    // Notificar a participantes de la app (excepto creador)
    if (changes.length > 0) {
      const appParticipants = event.participants.filter(p => p.toString() !== req.user.id);
      const changeText = changes.join(" y ");
      const notifications = appParticipants.map(userId => ({
        user: userId,
        event: event._id,
        message: `Se actualizó ${changeText} del evento "${event.title}"`,
        read: false
      }));

      if (notifications.length > 0) {
        const savedNotifs = await Notification.insertMany(notifications);
        const io = req.app.get("io");
        savedNotifs.forEach(n => {
          io.to(`user-${n.user}`).emit("new-notification", n);
        });
      }
    }

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al editar evento:", err);
    res.status(500).json({ error: "Error al editar evento" });
  }
});

// POST /api/events/:id/manual-participants - Agregar participante manual (solo creador)
router.post("/:id/manual-participants", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
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

    event.manualParticipants.push(name);
    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
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

    const updatedEvent = await Event.findById(req.params.id)
      .populate("creator", "email nombre apellido")
      .populate("participants", "email nombre apellido")
      .populate("messages.sender", "email nombre apellido")
      .populate("items.claimedBy", "email nombre apellido");

    res.json(updatedEvent);
    req.app.get("io").to(req.params.id).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al remover participante manual:", err);
    res.status(500).json({ error: "Error al remover participante manual" });
  }
});

export default router;
