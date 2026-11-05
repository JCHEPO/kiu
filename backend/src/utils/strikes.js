import Strike from "../models/Strike.js";
import User from "../models/User.js";
import { notify, formatFechaHora } from "./notify.js";
import { sendEmail } from "./email.js";

// Reglas de strikes (contexto del proyecto). Cambiar acá si se ajustan.
export const DIAS_VIGENCIA = 90;          // un strike vence a los 90 días
export const MAX_ACTIVOS = 3;             // con 3 activos, suspensión automática
export const DIAS_SUSPENSION = [7, 30];   // primera suspensión 7 días; desde la segunda, 30
export const HORAS_CANCELACION = 6;       // salir de un evento en cancha reservable a menos de 6 h = strike

const DIA = 24 * 60 * 60 * 1000;

// Strikes que cuentan hoy: no anulados, no vencidos y sin apelación aceptada
export const filtroActivos = (userId) => ({
  user: userId,
  anulado: false,
  venceAt: { $gt: new Date() },
  "apelacion.estado": { $ne: "aceptada" }
});

// Suspensión temporal por strikes (distinta de activo=false, que es un bloqueo indefinido del admin)
export const estaSuspendido = (user) =>
  !!user?.suspendidoHasta && new Date(user.suspendidoHasta).getTime() > Date.now();

export const mensajeSuspension = (user) =>
  `Tu cuenta está suspendida hasta el ${formatFechaHora(user.suspendidoHasta, " a las ")} por acumular ${MAX_ACTIVOS} strikes. Puedes ver y apelar tus strikes en tu perfil.`;

// Una sale de un evento a menos de HORAS_CANCELACION de que empiece (o ya empezado)
export const esCancelacionTarde = (event, ahora = Date.now()) =>
  new Date(event.date).getTime() - ahora < HORAS_CANCELACION * 60 * 60 * 1000;

/** Recalcula el contador User.strikes (lo que se muestra en el perfil y en el panel). */
export async function recalcular(userId) {
  const n = await Strike.countDocuments(filtroActivos(userId));
  await User.updateOne({ _id: userId }, { $set: { strikes: n } });
  return n;
}

const TEXTO_TIPO = {
  inasistencia: (t) => `no llegaste a "${t}"`,
  cancelacion_tarde: (t) => `saliste de "${t}" a menos de ${HORAS_CANCELACION} horas`,
  conducta: (t) => (t ? `un reporte de conducta en "${t}"` : "un reporte de conducta")
};

/**
 * Da un strike (si ya hay uno igual para ese evento, no lo repite), avisa a la persona y
 * revisa si corresponde suspender. Nunca lanza.
 */
export async function darStrike(io, { userId, event = null, tipo, origen, detalle = "" }) {
  try {
    const eventId = event?._id || null;
    if (eventId) {
      const ya = await Strike.findOne({ user: userId, event: eventId, tipo, anulado: false });
      if (ya) return ya;
    }
    const ahora = new Date();
    const strike = await Strike.create({
      user: userId, event: eventId, eventTitulo: event?.title || "", tipo, origen,
      detalle: String(detalle || "").slice(0, 300),
      creadoAt: ahora, venceAt: new Date(ahora.getTime() + DIAS_VIGENCIA * DIA)
    });
    const activos = await recalcular(userId);
    const motivo = TEXTO_TIPO[tipo](event?.title || "");
    notify(io, {
      userIds: [userId],
      event,
      message: `Recibiste un strike porque ${motivo} (${activos} de ${MAX_ACTIVOS}). Si es un error, puedes apelar desde tu perfil.`,
      email: {
        subject: "Recibiste un strike en Kiu",
        text: `Recibiste un strike porque ${motivo}. Tienes ${activos} de ${MAX_ACTIVOS}; con ${MAX_ACTIVOS} la cuenta se suspende por unos días. Cada strike vence a los ${DIAS_VIGENCIA} días.\nSi es un error, puedes apelar desde tu perfil.`
      }
    });
    await revisarSuspension(io, userId);
    return strike;
  } catch (err) {
    console.error("Error dando strike:", err);
    return null;
  }
}

/** Anula strikes (p.ej. el organizador corrigió la asistencia) y recalcula a las personas afectadas. */
export async function anularStrikes(filtro, motivo) {
  const afectados = await Strike.find({ ...filtro, anulado: false }).select("user suspensionAt");
  if (!afectados.length) return 0;
  await Strike.updateMany({ _id: { $in: afectados.map((s) => s._id) } }, { $set: { anulado: true, anuladoMotivo: motivo } });
  for (const userId of new Set(afectados.map((s) => String(s.user)))) {
    await recalcular(userId);
    // Si uno de los anulados había causado una suspensión vigente, se levanta
    if (afectados.some((s) => String(s.user) === userId && s.suspensionAt)) await levantarSuspension(userId);
  }
  return afectados.length;
}

export async function levantarSuspension(userId) {
  await User.updateOne({ _id: userId }, { $set: { suspendidoHasta: null } });
}

/**
 * Con MAX_ACTIVOS strikes activos que todavía no causaron una suspensión, suspende:
 * 7 días la primera vez, 30 desde la segunda.
 */
export async function revisarSuspension(io, userId) {
  const pendientes = await Strike.find({ ...filtroActivos(userId), suspensionAt: null }).select("_id");
  if (pendientes.length < MAX_ACTIVOS) return false;
  const user = await User.findById(userId).select("email nombre suspensiones suspendidoHasta");
  if (!user) return false;
  const previas = user.suspensiones || 0;
  const dias = DIAS_SUSPENSION[Math.min(previas, DIAS_SUSPENSION.length - 1)];
  const ahora = new Date();
  user.suspendidoHasta = new Date(ahora.getTime() + dias * DIA);
  user.suspensiones = previas + 1;
  await user.save();
  await Strike.updateMany({ _id: { $in: pendientes.map((s) => s._id) } }, { $set: { suspensionAt: ahora } });

  const texto = `Tu cuenta de Kiu quedó suspendida por ${dias} días (hasta el ${formatFechaHora(user.suspendidoHasta, " a las ")}) por acumular ${MAX_ACTIVOS} strikes. Mientras tanto no puedes crear eventos ni unirte. Puedes ver y apelar tus strikes en tu perfil.`;
  notify(io, { userIds: [userId], event: null, message: `Cuenta suspendida por ${dias} días por acumular ${MAX_ACTIVOS} strikes` });
  if (user.email) {
    sendEmail({ to: user.email, subject: "Tu cuenta de Kiu está suspendida", text: `${texto}\n\n— Kiu`, html: `<p>${texto}</p><p>— Kiu</p>` })
      .catch((err) => console.error("Error enviando email de suspensión:", err));
  }
  return true;
}
