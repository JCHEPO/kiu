// Calendario en formato iCalendar (.ics), para que los eventos aparezcan en el calendario del teléfono.
import { eventLink } from "./notify.js";

// Duración por defecto: el evento no guarda hora de término
export const DURACION_MIN = 90;

// 20261108T210000Z
const fechaIcs = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Texto escapado según RFC 5545 (comas, punto y coma, barras y saltos de línea)
const texto = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Las líneas largas se doblan a 75 bytes (los clientes de calendario lo exigen)
const doblar = (linea) => {
  const partes = [];
  let actual = "";
  for (const ch of linea) {
    if (Buffer.byteLength(actual + ch) > 73) { partes.push(actual); actual = " " + ch; }
    else actual += ch;
  }
  partes.push(actual);
  return partes.join("\r\n");
};

export function vevento(ev, ahora = new Date()) {
  const inicio = new Date(ev.date);
  const fin = new Date(inicio.getTime() + DURACION_MIN * 60 * 1000);
  const lugar = ev.comuna ? `${ev.location}, ${ev.comuna}` : ev.location;
  const link = eventLink(ev._id);
  const detalle = [ev.description, ev.lugarTipo === "gratuita" ? "Cancha de uso libre: puede estar ocupada al llegar." : "", `Ver en Kiu: ${link}`]
    .filter(Boolean).join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:${ev._id}@kiu`,
    `DTSTAMP:${fechaIcs(ahora)}`,
    `DTSTART:${fechaIcs(inicio)}`,
    `DTEND:${fechaIcs(fin)}`,
    `SUMMARY:${texto(ev.title)}`,
    `LOCATION:${texto(lugar)}`,
    `DESCRIPTION:${texto(detalle)}`,
    `URL:${link}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${texto(ev.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT"
  ];
}

export function calendario(eventos, nombre = "Kiu") {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kiu//Eventos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${texto(nombre)}`,
    "X-WR-TIMEZONE:America/Santiago",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...eventos.flatMap((ev) => vevento(ev)),
    "END:VCALENDAR"
  ];
  return lineas.map(doblar).join("\r\n") + "\r\n";
}
