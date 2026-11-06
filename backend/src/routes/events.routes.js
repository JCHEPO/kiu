import express from "express";
import mongoose from "mongoose";
import { authenticate, authorize, optionalAuth } from "../middleware/auth.middleware.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import Cancha from "../models/Cancha.js";
import { esLinkDeMaps } from "../utils/maps.js";
import { notify, formatFechaHora, totalParticipantes } from "../utils/notify.js";
import { registrarActividad } from "../utils/actividad.js";
import { vincularInscripcion } from "../utils/seguimiento.js";
import { darStrike, anularStrikes, estaSuspendido, mensajeSuspension, esCancelacionTarde, HORAS_CANCELACION } from "../utils/strikes.js";

const router = express.Router();

const MIN = 60 * 1000;
// Unirse se permite hasta 30 minutos después de la hora del evento ("voy llegando")
const MINUTOS_PARA_UNIRSE_TARDE = 30;
// La asistencia se marca desde que empieza el evento y hasta 7 días después
const DIAS_PARA_MARCAR_ASISTENCIA = 7;

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
    lugarTipo: e.lugarTipo || "otro",
    creator: e.creator ? { _id: e.creator._id, nombre: e.creator.nombre || "" } : null,
    participantCount: totalParticipantes(e),
    isPublicView: true
  };
};

// Tarjeta del inicio para quien no inició sesión: de qué trata, comuna y cuántos van.
// Sin nombres ni lugar exacto (contexto del proyecto: reglas de producto).
const toTarjetaPublica = (e) => ({
  _id: e._id,
  title: e.title,
  description: e.description,
  category: e.category,
  subcategory: e.subcategory,
  comuna: e.comuna,
  date: e.date,
  cost: e.cost,
  minParticipants: e.minParticipants,
  maxParticipants: e.maxParticipants,
  restriccionGenero: e.restriccionGenero,
  lugarTipo: e.lugarTipo || "otro",
  participantCount: totalParticipantes(e),
  isPublicView: true
});

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
// La lista nunca trae el muro, los ítems ni los nombres agregados a mano (solo el total de inscritos).
// Sin sesión, cada evento viene como tarjeta pública (sin nombres ni lugar exacto).
router.get("/", optionalAuth, async (req, res) => {
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
        .select("-messages -items")
        .populate("creator", USER_PUBLIC)
        .sort({ date: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter)
    ]);
    const lista = events.map((ev) => {
      if (!req.user) return toTarjetaPublica(ev);
      const { manualParticipants, ...resto } = ev.toJSON();
      return { ...resto, participantCount: totalParticipantes(ev) };
    });
    res.json({ events: lista, total, page, pages: Math.ceil(total / limit) });
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
  const { title, date, description, location, mapsUrl, minParticipants, maxParticipants, category, subcategory, cost, restriccionGenero, comuna, items, canchaId } = req.body;
  try {
    const creador = await User.findById(req.user.id).select("suspendidoHasta");
    if (estaSuspendido(creador)) return res.status(403).json({ error: mensajeSuspension(creador) });

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

    // Lugar del catálogo: se guarda su id y si es gratuito o reservable (afecta los strikes)
    let cancha = null, lugarTipo = "otro";
    if (canchaId !== undefined && canchaId !== null && canchaId !== "") {
      if (!mongoose.isValidObjectId(canchaId)) return res.status(400).json({ error: "Lugar inválido" });
      const c = await Cancha.findById(canchaId).select("gratuita");
      if (!c) return res.status(400).json({ error: "El lugar elegido ya no existe" });
      cancha = c._id;
      lugarTipo = c.gratuita === false ? "reservable" : "gratuita";
    }

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
      cancha,
      lugarTipo,
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
    // La asistencia solo la ve el organizador
    if (event.creator?._id?.toString() === req.user.id) {
      const conAsistencia = await Event.findById(event._id).select("asistencia").lean();
      return res.json({ ...event.toJSON(), asistencia: conAsistencia?.asistencia || [] });
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

    const user = await User.findById(req.user.id);
    if (estaSuspendido(user)) return res.status(403).json({ error: mensajeSuspension(user) });

    if (new Date(event.date).getTime() < Date.now() - MINUTOS_PARA_UNIRSE_TARDE * MIN) {
      return res.status(400).json({ error: "Este evento ya pasó" });
    }

    // Validar restricción de género
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

    // El cupo incluye a los participantes agregados a mano por el creador.
    // La inscripción es atómica: la condición de cupo se revisa en la misma operación que agrega a la
    // persona, así dos inscripciones al mismo tiempo no pueden pasarse del máximo.
    const inscrito = await Event.findOneAndUpdate(
      {
        _id: event._id,
        participants: { $ne: user._id },
        $expr: {
          $lt: [
            { $add: [{ $size: { $ifNull: ["$participants", []] } }, { $size: { $ifNull: ["$manualParticipants", []] } }] },
            "$maxParticipants"
          ]
        }
      },
      { $push: { participants: user._id } },
      { new: true }
    );
    if (!inscrito) {
      const actual = await Event.findById(event._id).select("participants");
      if (actual?.participants.some(p => p.toString() === req.user.id)) {
        return res.status(400).json({ error: "Ya estás en este evento" });
      }
      return res.status(400).json({ error: "Evento lleno" });
    }
    event.participants = inscrito.participants;

    // ¿Con esta inscripción llegó al mínimo? Se marca una sola vez (también atómico)
    let seConfirma = false;
    if (inscrito.minParticipants && !inscrito.confirmedAt && totalParticipantes(inscrito) >= inscrito.minParticipants) {
      const r = await Event.updateOne({ _id: event._id, confirmedAt: null }, { $set: { confirmedAt: new Date() } });
      seConfirma = r.modifiedCount === 1;
    }

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    const io = req.app.get("io");
    io.to(`event-${req.params.id}`).emit("event-updated", updatedEvent);

    registrarActividad("union", { user: req.user.id, event: event._id, via: req.body?.via === "vista_publica" ? "vista_publica" : "" });
    // ¿Llegó por un link compartido de este evento? (métrica de links que terminan en inscripción)
    vincularInscripcion({ visita: req.body?.visita, userId: req.user.id, eventId: event._id });

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

    const estaba = event.participants.some(p => p.toString() === req.user.id);
    event.participants = event.participants.filter(p => p.toString() !== req.user.id);
    await event.save();

    const updatedEvent = await findEventFull(req.params.id);

    res.json(updatedEvent);
    const io = req.app.get("io");
    io.to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
    registrarActividad("salida", { user: req.user.id, event: req.params.id });

    // Salir tarde de un evento en cancha reservable suma strike (el organizador ya pagó la reserva).
    // En canchas gratuitas y lugares libres avisar con tiempo no es obligatorio: no cuenta.
    if (estaba && event.lugarTipo === "reservable" && !event.noSeJugo && esCancelacionTarde(event)) {
      darStrike(io, { userId: req.user.id, event, tipo: "cancelacion_tarde", origen: "automatico" });
    }
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

    const { location, date, comuna, mapsUrl, canchaId } = req.body;
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

    // Al cambiar el lugar: si viene de la lista, se guarda su tipo (gratuita/reservable); si no, queda "otro"
    let canchaNueva = null;
    if (canchaId !== undefined && canchaId !== null && canchaId !== "") {
      if (!mongoose.isValidObjectId(canchaId)) return res.status(400).json({ error: "Lugar inválido" });
      canchaNueva = await Cancha.findById(canchaId).select("gratuita");
      if (!canchaNueva) return res.status(400).json({ error: "El lugar elegido ya no existe" });
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
      event.cancha = canchaNueva ? canchaNueva._id : null;
      event.lugarTipo = canchaNueva ? (canchaNueva.gratuita === false ? "reservable" : "gratuita") : "otro";
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

// PUT /api/events/:id/asistencia - El organizador marca quién llegó (solo creador)
// Body: { marcas: [{ user, estado: "llego" | "no_llego" }], noSeJugo?: boolean }
// - "no_llego" da un strike automático (la persona puede apelar); cambiarlo a "llego" lo anula.
// - noSeJugo (cancha ocupada, se suspendió): nadie recibe strike por este evento.
// Se puede marcar desde la hora del evento y hasta 7 días después.
router.put("/:id/asistencia", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Evento no encontrado" });
    const event = await Event.findById(req.params.id).select("+asistencia");
    if (!event) return res.status(404).json({ error: "Evento no encontrado" });
    if (event.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: "Solo el organizador puede marcar la asistencia" });
    }
    const inicio = new Date(event.date).getTime();
    if (Date.now() < inicio) return res.status(400).json({ error: "Podrás marcar la asistencia cuando empiece el evento" });
    if (Date.now() > inicio + DIAS_PARA_MARCAR_ASISTENCIA * 24 * 60 * MIN) {
      return res.status(400).json({ error: `La asistencia se marca hasta ${DIAS_PARA_MARCAR_ASISTENCIA} días después del evento` });
    }

    const { marcas, noSeJugo } = req.body || {};
    if (marcas !== undefined && !Array.isArray(marcas)) return res.status(400).json({ error: "Marcas inválidas" });
    if (noSeJugo !== undefined && typeof noSeJugo !== "boolean") return res.status(400).json({ error: "Valor inválido" });

    const participantes = new Set(event.participants.map(String));
    participantes.delete(String(event.creator));
    const nuevas = new Map();
    for (const m of marcas || []) {
      const uid = String(m?.user || "");
      if (!participantes.has(uid)) return res.status(400).json({ error: "Solo puedes marcar a personas inscritas en el evento" });
      if (!["llego", "no_llego"].includes(m.estado)) return res.status(400).json({ error: "Estado de asistencia inválido" });
      nuevas.set(uid, m.estado);
    }

    const antes = new Map(event.asistencia.map((a) => [String(a.user), a.estado]));
    const ahora = new Date();
    for (const [uid, estado] of nuevas) {
      const a = event.asistencia.find((x) => String(x.user) === uid);
      if (a) { if (a.estado !== estado) { a.estado = estado; a.at = ahora; } }
      else event.asistencia.push({ user: uid, estado, at: ahora });
    }
    if (typeof noSeJugo === "boolean") event.noSeJugo = noSeJugo;
    await event.save();

    // Strikes: se ajustan después de guardar (si fallan, la asistencia ya quedó)
    const io = req.app.get("io");
    if (event.noSeJugo) {
      await anularStrikes({ event: event._id, tipo: { $in: ["inasistencia", "cancelacion_tarde"] } }, "El organizador marcó que no se jugó");
    } else {
      for (const [uid, estado] of nuevas) {
        if (estado === "no_llego" && antes.get(uid) !== "no_llego") {
          await darStrike(io, { userId: uid, event, tipo: "inasistencia", origen: "organizador" });
        } else if (estado === "llego" && antes.get(uid) === "no_llego") {
          await anularStrikes({ event: event._id, user: uid, tipo: "inasistencia" }, "El organizador corrigió la asistencia");
        }
      }
      // Volvió a marcar que sí se jugó: los "no llegó" que ya estaban vuelven a contar
      if (noSeJugo === false) {
        for (const a of event.asistencia) {
          if (a.estado === "no_llego" && !nuevas.has(String(a.user))) {
            await darStrike(io, { userId: a.user, event, tipo: "inasistencia", origen: "organizador" });
          }
        }
      }
    }

    const updatedEvent = await findEventFull(req.params.id);
    res.json({ ...updatedEvent.toJSON(), asistencia: event.asistencia.map((a) => ({ user: a.user, estado: a.estado, at: a.at })) });
    io.to(`event-${req.params.id}`).emit("event-updated", updatedEvent);
  } catch (err) {
    console.error("Error al marcar asistencia:", err);
    res.status(500).json({ error: "Error al guardar la asistencia" });
  }
});

export default router;
