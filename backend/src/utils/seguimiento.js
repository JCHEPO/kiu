import crypto from "crypto";
import mongoose from "mongoose";
import LinkVisit from "../models/LinkVisit.js";

// Seguimiento de links compartidos (métrica "links que terminan en inscripción").
// Cada link lleva el id del evento en la ruta (/event/<id>) y el origen en ?o= (ver frontend/src/utils/seguimiento.js).

// Plazo para contar una inscripción como resultado del link
export const VENTANA_DIAS = 7;
const VENTANA_MS = VENTANA_DIAS * 24 * 60 * 60 * 1000;

// Origen: letras minúsculas, números, guion o guion bajo (p.ej. "wa", "qr", "afiche-cancha-1")
const ORIGEN_RE = /^[a-z0-9_-]{1,24}$/;
export const normalizarOrigen = (o) => (typeof o === "string" && ORIGEN_RE.test(o) ? o : "directo");

const VISITA_RE = /^[a-f0-9]{32}$/;
export const visitaValida = (v) => typeof v === "string" && VISITA_RE.test(v);

const desdeVentana = () => new Date(Date.now() - VENTANA_MS);

/** Anota que alguien abrió el link de un evento. Devuelve el código de la visita. */
export async function registrarApertura({ eventId, origen, userId = null }) {
  const visita = crypto.randomBytes(16).toString("hex");
  await LinkVisit.create({
    visita,
    event: eventId,
    origen: normalizarOrigen(origen),
    conSesion: !!userId,
    user: userId || null
  });
  return visita;
}

/**
 * Quien abrió un link sin cuenta acaba de crear una. Si la apertura es de los últimos 7 días,
 * se le asocia el usuario. No lanza: el registro ya se hizo igual.
 */
export async function vincularRegistro(visita, userId) {
  if (!visitaValida(visita) || !userId) return;
  try {
    await LinkVisit.updateOne(
      { visita, user: null, cuentaCreadaAt: null, abiertoAt: { $gte: desdeVentana() } },
      { $set: { user: userId, cuentaCreadaAt: new Date() } }
    );
  } catch (err) {
    console.error("Error vinculando registro con link:", err.message);
  }
}

/**
 * Alguien se inscribió en un evento. Si abrió un link de ese evento en los últimos 7 días
 * (lo trae `visita`, o quedó asociado a su cuenta al registrarse), se marca la inscripción.
 * Devuelve true si la inscripción vino de un link. No lanza.
 */
export async function vincularInscripcion({ visita, userId, eventId }) {
  if (!userId || !mongoose.isValidObjectId(eventId)) return false;
  const deEsteUsuario = { user: userId };
  const porCodigo = visitaValida(visita) ? { visita, user: { $in: [null, userId] } } : null;
  try {
    const r = await LinkVisit.findOneAndUpdate(
      {
        event: eventId,
        inscritoAt: null,
        abiertoAt: { $gte: desdeVentana() },
        $or: porCodigo ? [porCodigo, deEsteUsuario] : [deEsteUsuario]
      },
      { $set: { user: userId, inscritoAt: new Date() } },
      { sort: { abiertoAt: -1 } }
    );
    return !!r;
  } catch (err) {
    console.error("Error vinculando inscripción con link:", err.message);
    return false;
  }
}
