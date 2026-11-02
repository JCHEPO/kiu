import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Report from "../models/Report.js";
import Activity from "../models/Activity.js";
import { notify, formatFechaHora, totalParticipantes } from "../utils/notify.js";
import { eliminarCuenta } from "../utils/cuentas.js";

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
// Misma limpieza que "Borrar mi cuenta": eventos propios, mensajes, inscripciones y avisos (ver utils/cuentas.js)
router.delete("/users/:id", adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id))
      return res.status(400).json({ error: "No puedes eliminar tu propia cuenta desde el panel" });
    const user = await User.findById(req.params.id).select("_id");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    await eliminarCuenta(user._id, req.app.get("io"), { motivo: `admin ${req.user.id}` });
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
    const event = await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Evento eliminado" });

    // Avisar a todos los inscritos (incluido el creador) si el evento todavía no ocurría
    if (event && new Date(event.date).getTime() > Date.now()) {
      const cuando = formatFechaHora(event.date);
      notify(req.app.get("io"), {
        userIds: [event.creator, ...event.participants],
        event: null,
        message: `Se canceló "${event.title}" (${cuando})`,
        email: {
          subject: `Cancelado: ${event.title}`,
          text: `"${event.title}", que era el ${formatFechaHora(event.date, " a las ")} en ${event.location}, fue cancelado por el equipo de Kiu.`
        }
      });
    }
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

// --- REPORTES ---

// GET /api/admin/reports?estado=pendiente|resuelto|descartado
router.get("/reports", adminOnly, async (req, res) => {
  try {
    const estado = ["pendiente", "resuelto", "descartado"].includes(req.query.estado) ? req.query.estado : "pendiente";
    const reports = await Report.find({ estado })
      .populate("reporter", "nombre apellido email")
      .populate("targetUser", "nombre apellido email strikes activo")
      .populate("targetEvent", "title date")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

// PATCH /api/admin/reports/:id  { estado: "resuelto" | "descartado", sumarStrike?: true }
// sumarStrike suma un strike al usuario reportado (o al creador, si es un evento)
router.patch("/reports/:id", adminOnly, async (req, res) => {
  try {
    const { estado, sumarStrike } = req.body || {};
    if (!["resuelto", "descartado", "pendiente"].includes(estado)) return res.status(400).json({ error: "Estado inválido" });
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Reporte no encontrado" });
    report.estado = estado;
    report.resueltoPor = estado === "pendiente" ? null : req.user.id;
    report.resueltoAt = estado === "pendiente" ? null : new Date();
    await report.save();
    let strikes;
    if (sumarStrike === true && report.targetUser) {
      const u = await User.findByIdAndUpdate(report.targetUser, { $inc: { strikes: 1 } }, { new: true }).select("strikes");
      strikes = u?.strikes;
    }
    res.json({ ok: true, estado: report.estado, strikes });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el reporte" });
  }
});

// --- MÉTRICAS DEL PILOTO ---
// Las tres metas del roadmap + conteos de las últimas 8 semanas (semanas móviles de 7 días hacia atrás).
const DIA = 24 * 60 * 60 * 1000;
export const METAS = { repiten: 0.4, confirmados: 0.6, conversion: 0.3 };

router.get("/metrics", adminOnly, async (req, res) => {
  try {
    const ahora = Date.now();
    const SEMANAS = 8;

    // Conteos por semana
    const actividad = await Activity.find({ at: { $gte: new Date(ahora - SEMANAS * 7 * DIA) } }).select("tipo via at").lean();
    const semanas = Array.from({ length: SEMANAS }, (_, i) => ({
      desde: new Date(ahora - (i + 1) * 7 * DIA), hasta: new Date(ahora - i * 7 * DIA),
      registro: 0, evento_creado: 0, union: 0, salida: 0, vista_publica: 0
    }));
    for (const a of actividad) {
      const i = Math.floor((ahora - new Date(a.at).getTime()) / (7 * DIA));
      if (semanas[i] && a.tipo in semanas[i]) semanas[i][a.tipo]++;
    }

    // 1. Organizadores que crean un segundo evento dentro de 30 días.
    // Se combinan los eventos que existen y el registro de actividad (por si alguno se borró).
    // Solo cuentan quienes crearon su primer evento hace 30 días o más (los demás todavía no tuvieron el plazo).
    const [eventos, creadosLog] = await Promise.all([
      Event.find({}).select("creator createdAt").lean(),
      Activity.find({ tipo: "evento_creado", user: { $ne: null } }).select("user event at").lean()
    ]);
    const porCreador = new Map();
    const agregar = (user, eventId, fecha) => {
      if (!user || !fecha) return;
      const k = String(user);
      if (!porCreador.has(k)) porCreador.set(k, new Map());
      const m = porCreador.get(k);
      const clave = eventId ? String(eventId) : `log-${new Date(fecha).getTime()}`;
      if (!m.has(clave)) m.set(clave, new Date(fecha).getTime());
    };
    eventos.forEach((e) => agregar(e.creator, e._id, e.createdAt));
    creadosLog.forEach((a) => agregar(a.user, a.event, a.at));
    let elegibles = 0, repitieron = 0, yaRepitieron = 0;
    for (const m of porCreador.values()) {
      const fechas = [...m.values()].sort((a, b) => a - b);
      const repite = fechas.length > 1 && fechas[1] - fechas[0] <= 30 * DIA;
      if (repite) yaRepitieron++;
      if (ahora - fechas[0] >= 30 * DIA) { elegibles++; if (repite) repitieron++; }
    }

    // 2. Eventos de los últimos 60 días (ya ocurridos, con mínimo) que llegaron al mínimo
    const pasados = await Event.find({
      date: { $lt: new Date(ahora), $gte: new Date(ahora - 60 * DIA) },
      minParticipants: { $gt: 0 }
    }).select("minParticipants participants manualParticipants confirmedAt").lean();
    const confirmados = pasados.filter((e) => e.confirmedAt || totalParticipantes(e) >= e.minParticipants).length;

    // 3. Últimos 30 días: uniones de quien vio el evento sin cuenta / vistas sin cuenta.
    // Cada carga de la página cuenta como vista, así que el valor real es igual o mayor.
    const desde30 = new Date(ahora - 30 * DIA);
    const [vistas, unionesLink] = await Promise.all([
      Activity.countDocuments({ tipo: "vista_publica", at: { $gte: desde30 } }),
      Activity.countDocuments({ tipo: "union", via: "vista_publica", at: { $gte: desde30 } })
    ]);

    const ratio = (n, d) => (d > 0 ? n / d : null);
    res.json({
      generado: new Date(ahora).toISOString(),
      kpis: [
        {
          clave: "repiten", titulo: "Organizadores que crean un segundo evento en 30 días",
          valor: ratio(repitieron, elegibles), numerador: repitieron, denominador: elegibles, meta: METAS.repiten,
          nota: `Cuenta a quien creó su primer evento hace 30 días o más. Ya repitieron ${yaRepitieron} de ${porCreador.size} organizadores en total.`
        },
        {
          clave: "confirmados", titulo: "Eventos que llegan al mínimo de participantes",
          valor: ratio(confirmados, pasados.length), numerador: confirmados, denominador: pasados.length, meta: METAS.confirmados,
          nota: "Eventos ya ocurridos en los últimos 60 días que tenían un mínimo."
        },
        {
          clave: "conversion", titulo: "Personas que abren un link compartido y se unen",
          valor: ratio(unionesLink, vistas), numerador: unionesLink, denominador: vistas, meta: METAS.conversion,
          nota: "Últimos 30 días. Cada carga de la página sin cuenta cuenta como una vista, así que es un valor conservador."
        }
      ],
      semanas
    });
  } catch (err) {
    console.error("Error calculando métricas:", err);
    res.status(500).json({ error: "Error al calcular métricas" });
  }
});

export default router;
