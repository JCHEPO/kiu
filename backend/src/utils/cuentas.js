import User from "../models/User.js";
import Event from "../models/Event.js";
import Notification from "../models/Notification.js";
import Report from "../models/Report.js";
import Activity from "../models/Activity.js";
import { notify, formatFechaHora } from "./notify.js";

/**
 * Borra una cuenta y sus datos personales (derecho de supresión). Lo usan "Borrar mi cuenta"
 * y el admin al eliminar un usuario.
 *
 * - Eventos que creó: se borran. Si todavía no ocurrían, se avisa la cancelación a los inscritos.
 * - En eventos de otros: se le quita de los participantes, se borran sus mensajes del muro y se
 *   liberan los ítems que se había anotado a llevar.
 * - Sus notificaciones se borran.
 * - Reportes que envió y su actividad (métricas) quedan sin su identidad (user/reporter en null).
 *   Los reportes en su contra se conservan para la moderación.
 */
export async function eliminarCuenta(userId, io, { motivo = "usuario" } = {}) {
  const id = String(userId);

  const creados = await Event.find({ creator: id }).select("title date location participants");
  for (const ev of creados) {
    if (new Date(ev.date).getTime() > Date.now()) {
      notify(io, {
        userIds: ev.participants.filter((p) => String(p) !== id),
        event: null,
        message: `Se canceló "${ev.title}" (${formatFechaHora(ev.date)})`,
        email: {
          subject: `Cancelado: ${ev.title}`,
          text: `"${ev.title}", que era el ${formatFechaHora(ev.date, " a las ")} en ${ev.location}, se canceló porque el organizador ya no está en Kiu.`
        }
      });
    }
  }
  await Event.deleteMany({ creator: id });

  await Event.updateMany({ participants: id }, { $pull: { participants: id } });
  await Event.updateMany({ "messages.sender": id }, { $pull: { messages: { sender: id } } });
  await Event.updateMany(
    { "items.claimedBy": id },
    { $set: { "items.$[it].claimedBy": null } },
    { arrayFilters: [{ "it.claimedBy": id }] }
  );

  await Notification.deleteMany({ user: id });
  await Report.updateMany({ reporter: id }, { $set: { reporter: null } });
  await Activity.updateMany({ user: id }, { $set: { user: null } });

  const borrado = await User.findByIdAndDelete(id);
  console.log(`Cuenta eliminada (${motivo}): ${id}, ${creados.length} eventos propios borrados`);
  return borrado;
}

/**
 * Copia de los datos de una persona (derecho de acceso y portabilidad), en JSON.
 */
export async function exportarDatos(userId) {
  const id = String(userId);
  const u = await User.findById(id).lean();
  if (!u) return null;
  // Lista explícita de campos: nunca se incluyen la contraseña (cifrada) ni el token de recuperación
  const user = {
    id: u._id, nombre: u.nombre, apellido: u.apellido, email: u.email, genero: u.genero,
    fechaNacimiento: u.fechaNacimiento, telefono: u.telefono, fechaRegistro: u.fechaRegistro,
    verificado: !!u.verificado, rol: u.rol, strikes: u.strikes || 0, activo: u.activo !== false,
    conectadoConGoogle: !!u.googleId, conectadoConFacebook: !!u.facebookId,
    aceptaTerminosAt: u.aceptaTerminosAt, terminosVersion: u.terminosVersion
  };

  const resumenEvento = (e) => ({ id: e._id, titulo: e.title, fecha: e.date, lugar: e.location, comuna: e.comuna });
  const [creados, inscrito, conMensajes, notificaciones, reportes] = await Promise.all([
    Event.find({ creator: id }).lean(),
    Event.find({ participants: id, creator: { $ne: id } }).lean(),
    Event.find({ "messages.sender": id }).select("title messages").lean(),
    Notification.find({ user: id }).sort({ createdAt: -1 }).lean(),
    Report.find({ reporter: id }).select("tipo motivo detalle estado createdAt targetTitulo").lean()
  ]);

  return {
    generado: new Date().toISOString(),
    perfil: user,
    eventosCreados: creados.map(resumenEvento),
    eventosEnLosQueParticipo: inscrito.map(resumenEvento),
    mensajesEnMuros: conMensajes.flatMap((e) =>
      (e.messages || []).filter((m) => String(m.sender) === id).map((m) => ({ evento: e.title, texto: m.text, fecha: m.createdAt }))
    ),
    notificaciones: notificaciones.map((n) => ({ mensaje: n.message, leida: n.read, fecha: n.createdAt })),
    reportesEnviados: reportes
  };
}
