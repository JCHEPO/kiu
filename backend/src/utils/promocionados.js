// Eventos promocionados: talleres, catas, cursos... en un local que le paga a Kiu por cada persona que llega.
// Quién llegó se cuenta con un código que el local muestra (impreso o en QR): así el local y Kiu
// ven el mismo número y no depende solo de lo que marque el organizador.
import crypto from "crypto";
import Event from "../models/Event.js";

// Sin letras ni números que se confunden al leerlos (0/O, 1/I/L)
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LARGO_CODIGO = 6;

export const nuevoCodigo = () =>
  Array.from({ length: LARGO_CODIGO }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join("");

export const normalizarCodigo = (c) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

// El código sirve desde 1 hora antes hasta 4 horas después del inicio
export const MIN_ANTES_CHECKIN = 60;
export const HORAS_DESPUES_CHECKIN = 4;

export const ventanaCheckin = (date, ahora = Date.now()) => {
  const inicio = new Date(date).getTime();
  if (ahora < inicio - MIN_ANTES_CHECKIN * 60 * 1000) return "antes";
  if (ahora > inicio + HORAS_DESPUES_CHECKIN * 60 * 60 * 1000) return "despues";
  return "abierta";
};

// Tarifa que el local paga por persona: entero entre 0 y 100.000 CLP
export const tarifaValida = (t) => Number.isInteger(t) && t >= 0 && t <= 100000;

// "2026-11" → [inicio, fin) del mes en hora de Chile
export function rangoMes(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes || ""));
  if (!m) return null;
  const anio = Number(m[1]), num = Number(m[2]);
  if (num < 1 || num > 12) return null;
  // Medianoche en Chile: el desfase cambia con el horario de verano, así que se calcula para cada fecha
  const medianoche = (a, mm) => {
    const utc = Date.UTC(a, mm - 1, 1, 12);
    const offset = desfaseChile(new Date(utc));
    return new Date(Date.UTC(a, mm - 1, 1) - offset);
  };
  const siguiente = num === 12 ? [anio + 1, 1] : [anio, num + 1];
  return [medianoche(anio, num), medianoche(...siguiente)];
}

// Desfase de America/Santiago respecto de UTC, en ms (negativo: Chile va detrás)
function desfaseChile(fecha) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(fecha).reduce((o, p) => (o[p.type] = p.value, o), {});
  const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
  return comoUtc - fecha.getTime();
}

// Reporte del mes por local: eventos, inscritos, cuántos llegaron y cuánto le toca pagar.
export async function reporteLocales(mes) {
  const rango = rangoMes(mes);
  if (!rango) return null;
  const eventos = await Event.find({ promocionado: true, date: { $gte: rango[0], $lt: rango[1] } })
    .select("title date location comuna cancha participants creator +asistencia +tarifaKiu noSeJugo")
    .populate("cancha", "nombre comuna categoria")
    .sort({ date: 1 })
    .lean();

  const porLocal = new Map();
  for (const ev of eventos) {
    const clave = ev.cancha?._id ? String(ev.cancha._id) : `sin-local:${ev.location}`;
    if (!porLocal.has(clave)) {
      porLocal.set(clave, {
        lugarId: ev.cancha?._id || null,
        nombre: ev.cancha?.nombre || ev.location,
        comuna: ev.cancha?.comuna || ev.comuna || "",
        eventos: [], inscritos: 0, llegaron: 0, monto: 0
      });
    }
    const local = porLocal.get(clave);
    const creador = String(ev.creator);
    const inscritos = (ev.participants || []).filter((p) => String(p) !== creador).length;
    const llegaron = (ev.asistencia || []).filter((a) => a.estado === "llego" && String(a.user) !== creador).length;
    const porCodigo = (ev.asistencia || []).filter((a) => a.estado === "llego" && a.via === "codigo" && String(a.user) !== creador).length;
    const tarifa = ev.tarifaKiu || 0;
    const monto = ev.noSeJugo ? 0 : llegaron * tarifa;
    local.eventos.push({ _id: ev._id, title: ev.title, date: ev.date, inscritos, llegaron, porCodigo, tarifa, monto, noSeJugo: !!ev.noSeJugo });
    local.inscritos += inscritos;
    local.llegaron += llegaron;
    local.monto += monto;
  }
  const locales = [...porLocal.values()].sort((a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre));
  return {
    mes,
    locales,
    total: locales.reduce((s, l) => s + l.monto, 0),
    llegaron: locales.reduce((s, l) => s + l.llegaron, 0)
  };
}
