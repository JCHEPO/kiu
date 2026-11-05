// Agregar un evento al calendario del teléfono.
// - archivo .ics: en iPhone abre "Agregar al calendario"; en Android se abre con la app de calendario.
// - Google Calendar: abre el formulario de evento ya completado (web o app).
// Para que todos los eventos aparezcan solos, ver la suscripción en el perfil (/api/calendario/<código>.ics).

const DURACION_MIN = 90; // igual que en el backend (utils/ics.js)

const fechaIcs = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapar = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const datos = (event) => {
  const inicio = new Date(event.date);
  const fin = new Date(inicio.getTime() + DURACION_MIN * 60 * 1000);
  const lugar = event.comuna && event.location ? `${event.location}, ${event.comuna}` : (event.location || event.comuna || "");
  const link = `${window.location.origin}/event/${event._id}`;
  const detalle = [
    event.lugarTipo === "gratuita" ? "Cancha de uso libre: puede estar ocupada al llegar." : "",
    `Ver en Kiu: ${link}`
  ].filter(Boolean).join("\n");
  return { inicio, fin, lugar, link, detalle };
};

export function descargarIcs(event) {
  const { inicio, fin, lugar, link, detalle } = datos(event);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kiu//Eventos//ES", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event._id}@kiu`,
    `DTSTAMP:${fechaIcs(new Date())}`,
    `DTSTART:${fechaIcs(inicio)}`,
    `DTEND:${fechaIcs(fin)}`,
    `SUMMARY:${escapar(event.title)}`,
    `LOCATION:${escapar(lugar)}`,
    `DESCRIPTION:${escapar(detalle)}`,
    `URL:${link}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapar(event.title)}`, "TRIGGER:-PT2H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "kiu-evento.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function linkGoogleCalendar(event) {
  const { inicio, fin, lugar, detalle } = datos(event);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fechaIcs(inicio)}/${fechaIcs(fin)}`,
    details: detalle,
    location: lugar
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
