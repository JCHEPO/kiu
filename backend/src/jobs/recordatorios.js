import Event from "../models/Event.js";
import { notify, formatFechaHora } from "../utils/notify.js";

// Se avisa a los participantes cuando faltan menos de estas horas para el evento
export const HORAS_ANTES = 3;

/**
 * Busca eventos que empiezan dentro de las próximas HORAS_ANTES horas y que todavía no
 * tuvieron recordatorio, y avisa a sus participantes (app + email).
 * Corre cada 10 minutos desde server.js y también se puede disparar con un cron externo
 * (POST /api/internal/recordatorios), útil si el host apaga el servidor cuando no hay tráfico.
 * Devuelve cuántos eventos se avisaron.
 */
export async function enviarRecordatorios(io) {
  const ahora = Date.now();
  const ventanaMs = HORAS_ANTES * 60 * 60 * 1000;
  const candidatos = await Event.find({
    date: { $gt: new Date(ahora), $lte: new Date(ahora + ventanaMs) },
    reminderSentAt: null
  }).select("title date location participants createdAt");

  let enviados = 0;
  for (const event of candidatos) {
    // Marcar primero, de forma atómica: si dos procesos corren a la vez, solo uno avisa
    const marcado = await Event.updateOne(
      { _id: event._id, reminderSentAt: null },
      { $set: { reminderSentAt: new Date() } }
    );
    if (marcado.modifiedCount !== 1) continue;

    // Un evento creado cuando ya faltaba poco no necesita recordatorio (la gente recién se enteró)
    if (new Date(event.createdAt).getTime() > new Date(event.date).getTime() - ventanaMs) continue;

    const cuando = formatFechaHora(event.date, " a las ");
    await notify(io, {
      userIds: event.participants,
      event,
      message: `Recordatorio: "${event.title}" es el ${cuando} en ${event.location}`,
      email: {
        subject: `Recordatorio: ${event.title}`,
        text: `Te recordamos que "${event.title}" es el ${cuando} en ${event.location}.\nSi ya no puedes ir, sal del evento para liberar tu cupo.`
      }
    });
    enviados++;
  }
  return enviados;
}
