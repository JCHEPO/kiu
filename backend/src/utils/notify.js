import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendEmail } from "./email.js";

// Zona horaria para mostrar fechas en avisos y vistas previas (el servidor corre en UTC)
const TIMEZONE = process.env.APP_TIMEZONE || "America/Santiago";

export const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
export const eventLink = (eventId) => `${frontendUrl()}/event/${eventId}`;

// "sábado 8 de noviembre, 18:00" — o con separador " a las " para usar dentro de una frase
export const formatFechaHora = (date, separador = ", ") => {
  const d = new Date(date);
  const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long" })
    .format(d)
    .replace(",", ""); // "sábado, 8 de noviembre" → "sábado 8 de noviembre"
  const hora = new Intl.DateTimeFormat("es-CL", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${fecha}${separador}${hora}`;
};

// Total de inscritos: usuarios de la app + participantes agregados a mano por el creador
export const totalParticipantes = (event) =>
  (event.participants?.length || 0) + (event.manualParticipants?.length || 0);

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Avisa a varios usuarios: notificación en la app (en tiempo real si están conectados) y,
 * si se pasa `email`, también por correo.
 * Nunca lanza: si un aviso falla, la acción del usuario (unirse, borrar, etc.) ya se hizo igual.
 *
 * @param io       instancia de Socket.IO (req.app.get("io"))
 * @param userIds  ids de destinatarios (se eliminan duplicados)
 * @param event    evento relacionado, o null si ya no existe (cancelado)
 * @param message  texto corto para la app
 * @param email    { subject, text } opcional; se agrega el link al evento si existe
 */
export async function notify(io, { userIds, event, message, email }) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return;

    const eventId = event?._id || null;
    const docs = await Notification.insertMany(ids.map((user) => ({ user, event: eventId, message })));
    const eventInfo = eventId ? { _id: eventId, title: event.title } : null;
    docs.forEach((n) => {
      const plain = typeof n.toObject === "function" ? n.toObject() : n;
      io?.to(`user-${n.user}`).emit("new-notification", { ...plain, event: eventInfo });
    });

    if (email) {
      const users = await User.find({ _id: { $in: ids }, activo: { $ne: false } }).select("email");
      const link = eventId ? eventLink(eventId) : frontendUrl();
      const text = `${email.text}\n\n${link}\n\n— Kiu`;
      const html = `<p>${escapeHtml(email.text).replace(/\n/g, "<br>")}</p><p><a href="${link}">${eventId ? "Ver el evento" : "Abrir Kiu"}</a></p><p>— Kiu</p>`;
      const results = await Promise.allSettled(
        users.filter((u) => u.email).map((u) => sendEmail({ to: u.email, subject: email.subject, text, html }))
      );
      results.filter((r) => r.status === "rejected").forEach((r) => console.error("Error enviando email de aviso:", r.reason));
    }
  } catch (err) {
    console.error("Error enviando avisos:", err);
  }
}
