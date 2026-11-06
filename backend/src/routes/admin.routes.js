import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Report from "../models/Report.js";
import Activity from "../models/Activity.js";
import LinkVisit from "../models/LinkVisit.js";
import Strike from "../models/Strike.js";
import { darStrike, anularStrikes, recalcular, levantarSuspension } from "../utils/strikes.js";
import { VENTANA_DIAS } from "../utils/seguimiento.js";
import { notify, formatFechaHora, totalParticipantes } from "../utils/notify.js";
import { eliminarCuenta } from "../utils/cuentas.js";
import { reporteLocales } from "../utils/promocionados.js";

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
    const { activo, verificado, solicitaVerificacion, strikes, levantarSuspension: levantar, suspenderDias } = req.body;
    const update = {};
    // Suspensión temporal manual (conducta grave) o levantar una suspensión
    if (levantar === true) update.suspendidoHasta = null;
    if (suspenderDias !== undefined) {
      const dias = parseInt(suspenderDias);
      if (!Number.isInteger(dias) || dias < 1 || dias > 365) return res.status(400).json({ error: "Días de suspensión inválidos" });
      update.suspendidoHasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    }
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
      // Conducta: nunca automático; lo da el admin al resolver el reporte. Cuenta para la suspensión automática.
      const ev = report.targetEvent ? await Event.findById(report.targetEvent).select("title") : null;
      await darStrike(req.app.get("io"), {
        userId: report.targetUser,
        event: ev || (report.targetTitulo && report.tipo === "evento" ? { _id: null, title: report.targetTitulo } : null),
        tipo: "conducta",
        origen: "admin",
        detalle: report.motivo
      });
      strikes = (await User.findById(report.targetUser).select("strikes"))?.strikes;
    }
    res.json({ ok: true, estado: report.estado, strikes });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el reporte" });
  }
});

// --- APELACIONES DE STRIKES ---

// GET /api/admin/apelaciones - strikes con apelación pendiente
router.get("/apelaciones", adminOnly, async (req, res) => {
  try {
    const strikes = await Strike.find({ "apelacion.estado": "pendiente", anulado: false })
      .populate("user", "nombre apellido email strikes suspendidoHasta")
      .sort({ "apelacion.at": 1 })
      .limit(200)
      .lean();
    res.json(strikes);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener apelaciones" });
  }
});

// PATCH /api/admin/strikes/:id  { apelacion: "aceptada" | "rechazada" } o { anular: true }
// Aceptar la apelación (o anular) quita el strike; si había causado una suspensión vigente, se levanta.
router.patch("/strikes/:id", adminOnly, async (req, res) => {
  try {
    const { apelacion, anular } = req.body || {};
    const strike = await Strike.findById(req.params.id);
    if (!strike) return res.status(404).json({ error: "Strike no encontrado" });
    if (anular === true || apelacion === "aceptada") {
      if (apelacion === "aceptada") {
        strike.apelacion.estado = "aceptada";
        strike.apelacion.resueltaAt = new Date();
        await strike.save();
      }
      await anularStrikes({ _id: strike._id }, apelacion === "aceptada" ? "Apelación aceptada" : `Anulado por admin ${req.user.id}`);
      if (strike.suspensionAt) await levantarSuspension(strike.user);
    } else if (apelacion === "rechazada") {
      strike.apelacion.estado = "rechazada";
      strike.apelacion.resueltaAt = new Date();
      await strike.save();
    } else {
      return res.status(400).json({ error: "Acción inválida" });
    }
    const activos = await recalcular(strike.user);
    notify(req.app.get("io"), {
      userIds: [strike.user],
      event: null,
      message: apelacion === "rechazada"
        ? `Revisamos tu apelación${strike.eventTitulo ? ` por "${strike.eventTitulo}"` : ""} y el strike se mantiene.`
        : `Quitamos un strike${strike.eventTitulo ? ` por "${strike.eventTitulo}"` : ""}. Tienes ${activos} activos.`
    });
    res.json({ ok: true, activos });
  } catch (err) {
    console.error("Error resolviendo strike:", err);
    res.status(500).json({ error: "Error al actualizar el strike" });
  }
});

// --- MÉTRICAS DEL PILOTO ---
// Las tres metas del roadmap + conteos de las últimas 8 semanas (semanas móviles de 7 días hacia atrás).
const DIA = 24 * 60 * 60 * 1000;
// Metas del piloto formal (contexto del proyecto). jugadosSemana es una cantidad, no un porcentaje.
export const METAS = { repiten: 0.4, confirmados: 0.6, conversion: 0.15, asistencia: null, jugadosSemana: 10 };

// Un evento "se jugó" si ya ocurrió, el organizador no marcó "no se jugó" y llegó al mínimo
// (o, si no tenía mínimo, tuvo al menos 2 inscritos).
const seJugo = (e) => !e.noSeJugo && (e.minParticipants > 0
  ? (!!e.confirmedAt || totalParticipantes(e) >= e.minParticipants)
  : totalParticipantes(e) >= 2);

// Llegó al mínimo antes de empezar. Los eventos anteriores a confirmedAt se miden con los inscritos actuales.
const llegoAlMinimo = (e) => e.confirmedAt
  ? new Date(e.confirmedAt).getTime() <= new Date(e.date).getTime()
  : totalParticipantes(e) >= e.minParticipants;

router.get("/metrics", adminOnly, async (req, res) => {
  try {
    const ahora = Date.now();
    const SEMANAS = 8;
    const desde8 = new Date(ahora - SEMANAS * 7 * DIA);

    // Los eventos promocionados (talleres en locales) no cuentan para las metas del piloto:
    // tienen su propio reporte (GET /locales).
    const promo = new Set((await Event.distinct("_id", { promocionado: true })).map(String));
    const deEventoPromo = (id) => !!id && promo.has(String(id));
    const noPromo = { promocionado: { $ne: true } };

    // Conteos por semana
    const [actividadTodas, aperturasTodas, ocurridos8] = await Promise.all([
      Activity.find({ at: { $gte: desde8 } }).select("tipo via at event").lean(),
      LinkVisit.find({ abiertoAt: { $gte: desde8 } }).select("abiertoAt event").lean(),
      Event.find({ date: { $gte: desde8, $lt: new Date(ahora) }, ...noPromo })
        .select("date minParticipants participants manualParticipants confirmedAt noSeJugo").lean()
    ]);
    const actividad = actividadTodas.filter((a) => !deEventoPromo(a.event));
    const aperturas8 = aperturasTodas.filter((v) => !deEventoPromo(v.event));
    const semanas = Array.from({ length: SEMANAS }, (_, i) => ({
      desde: new Date(ahora - (i + 1) * 7 * DIA), hasta: new Date(ahora - i * 7 * DIA),
      registro: 0, evento_creado: 0, union: 0, salida: 0, vista_publica: 0, aperturas: 0, jugados: 0
    }));
    const semanaDe = (fecha) => semanas[Math.floor((ahora - new Date(fecha).getTime()) / (7 * DIA))];
    for (const a of actividad) {
      const w = semanaDe(a.at);
      if (w && a.tipo in w) w[a.tipo]++;
    }
    for (const v of aperturas8) { const w = semanaDe(v.abiertoAt); if (w) w.aperturas++; }
    for (const e of ocurridos8) { const w = semanaDe(e.date); if (w && seJugo(e)) w.jugados++; }

    // 1. Organizadores que crean un segundo evento dentro de 30 días.
    // Se combinan los eventos que existen y el registro de actividad (por si alguno se borró).
    // Solo cuentan quienes crearon su primer evento hace 30 días o más (los demás todavía no tuvieron el plazo).
    const [eventos, creadosLog] = await Promise.all([
      Event.find(noPromo).select("creator createdAt").lean(),
      Activity.find({ tipo: "evento_creado", user: { $ne: null } }).select("user event at").lean()
        .then((lista) => lista.filter((a) => !deEventoPromo(a.event)))
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

    // 2. Eventos de los últimos 60 días (ya ocurridos, con mínimo) que llegaron al mínimo antes de empezar
    const pasados = await Event.find({ date: { $lt: new Date(ahora), $gte: new Date(ahora - 60 * DIA) }, ...noPromo })
      .select("date minParticipants participants manualParticipants confirmedAt noSeJugo asistencia").lean();
    const conMinimo = pasados.filter((e) => e.minParticipants > 0);
    const confirmados = conMinimo.filter(llegoAlMinimo).length;

    // 3. Links: de quienes abrieron un link en los últimos 30 días, cuántos se inscribieron en ese evento
    // dentro de 7 días (contando crear la cuenta). Las aperturas muy recientes todavía pueden convertir.
    const desde30 = new Date(ahora - 30 * DIA);
    const visitas = (await LinkVisit.find({ abiertoAt: { $gte: desde30 } })
      .select("event origen conSesion user abiertoAt cuentaCreadaAt inscritoAt").lean())
      .filter((v) => !deEventoPromo(v.event));
    const ventanaMs = VENTANA_DIAS * DIA;
    const seInscribio = (v) => v.inscritoAt && new Date(v.inscritoAt).getTime() - new Date(v.abiertoAt).getTime() <= ventanaMs;
    const inscritosLink = visitas.filter(seInscribio);

    // Asistencia de quienes llegaron por un link: cruza la inscripción con lo que marcó el organizador
    const eventosLink = [...new Set(inscritosLink.map((v) => String(v.event)))];
    const asistenciaLink = eventosLink.length
      ? await Event.find({ _id: { $in: eventosLink } }).select("asistencia noSeJugo").lean()
      : [];
    const llegoA = new Set();
    for (const e of asistenciaLink) {
      for (const a of e.asistencia || []) if (a.estado === "llego") llegoA.add(`${e._id}:${a.user}`);
    }
    const asistieronLink = inscritosLink.filter((v) => v.user && llegoA.has(`${v.event}:${v.user}`)).length;

    const porOrigen = new Map();
    for (const v of visitas) {
      const o = porOrigen.get(v.origen) || { origen: v.origen, aperturas: 0, inscritos: 0 };
      o.aperturas++;
      if (seInscribio(v)) o.inscritos++;
      porOrigen.set(v.origen, o);
    }
    const sinCuenta = visitas.filter((v) => !v.conSesion);
    const embudo = {
      aperturas: visitas.length,
      sinCuenta: sinCuenta.length,
      cuentasCreadas: sinCuenta.filter((v) => v.cuentaCreadaAt).length,
      inscritos: inscritosLink.length,
      asistieron: asistieronLink,
      porOrigen: [...porOrigen.values()].sort((a, b) => b.aperturas - a.aperturas)
    };

    // 4. Asistencia: de las personas que el organizador marcó, cuántas llegaron (eventos jugados de los últimos 60 días)
    let llegaron = 0, marcados = 0, eventosConMarcas = 0;
    for (const e of pasados) {
      if (e.noSeJugo || !(e.asistencia || []).length) continue;
      eventosConMarcas++;
      for (const a of e.asistencia) { marcados++; if (a.estado === "llego") llegaron++; }
    }

    const ratio = (n, d) => (d > 0 ? n / d : null);
    res.json({
      generado: new Date(ahora).toISOString(),
      kpis: [
        {
          clave: "repiten", titulo: "Organizadores que crean otro evento en 30 días",
          valor: ratio(repitieron, elegibles), numerador: repitieron, denominador: elegibles, meta: METAS.repiten,
          nota: `Cuenta a quien creó su primer evento hace 30 días o más. Ya repitieron ${yaRepitieron} de ${porCreador.size} organizadores en total.`
        },
        {
          clave: "confirmados", titulo: "Eventos que llegan al mínimo antes de empezar",
          valor: ratio(confirmados, conMinimo.length), numerador: confirmados, denominador: conMinimo.length, meta: METAS.confirmados,
          nota: `Eventos ya ocurridos en los últimos 60 días que tenían un mínimo (${pasados.length - conMinimo.length} sin mínimo no cuentan).`
        },
        {
          clave: "conversion", titulo: `Personas que abren un link y se inscriben en ${VENTANA_DIAS} días`,
          valor: ratio(inscritosLink.length, visitas.length), numerador: inscritosLink.length, denominador: visitas.length, meta: METAS.conversion,
          nota: `Links abiertos en los últimos 30 días, contando a quien tuvo que crear cuenta. No cuenta al organizador ni a quien ya estaba inscrito. Las aperturas de los últimos ${VENTANA_DIAS} días todavía pueden convertir.`
        },
        {
          clave: "asistencia", titulo: "Inscritos que llegan",
          valor: ratio(llegaron, marcados), numerador: llegaron, denominador: marcados, meta: METAS.asistencia,
          nota: `Según lo que marcó el organizador en ${eventosConMarcas} eventos de los últimos 60 días. Sin meta: se sigue.`
        },
        {
          clave: "jugadosSemana", titulo: "Eventos jugados en los últimos 7 días", formato: "numero",
          valor: semanas[0].jugados, numerador: semanas[0].jugados, denominador: null, meta: METAS.jugadosSemana,
          nota: "Ya ocurrieron, llegaron al mínimo (o tuvieron 2+ inscritos si no tenían mínimo) y no se marcó \"no se jugó\". Meta para el final del piloto."
        }
      ],
      embudo,
      semanas
    });
  } catch (err) {
    console.error("Error calculando métricas:", err);
    res.status(500).json({ error: "Error al calcular métricas" });
  }
});

// GET /api/admin/locales?mes=2026-11 - Eventos promocionados del mes por local: inscritos, cuántos llegaron
// y cuánto le toca pagar a cada local (personas que llegaron × tarifa del evento).
router.get("/locales", adminOnly, async (req, res) => {
  try {
    const mes = typeof req.query.mes === "string" ? req.query.mes : "";
    const reporte = await reporteLocales(mes);
    if (!reporte) return res.status(400).json({ error: "Mes inválido (usa AAAA-MM)" });
    res.json(reporte);
  } catch (err) {
    console.error("Error en reporte de locales:", err);
    res.status(500).json({ error: "Error al armar el reporte" });
  }
});

export default router;
