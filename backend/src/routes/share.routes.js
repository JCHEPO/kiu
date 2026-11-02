import express from "express";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import { frontendUrl, eventLink, formatFechaHora, totalParticipantes } from "../utils/notify.js";

// Vista previa de links compartidos (WhatsApp, Telegram, iMessage, Facebook...).
// Esos servicios leen las etiquetas <meta property="og:..."> del HTML y NO ejecutan JavaScript,
// así que la app de React no les sirve: esta ruta arma un HTML mínimo con el nombre del evento,
// la fecha, el lugar y los cupos. Una persona que abre este link es enviada a la página real.
//
// Uso: el frontend (Vercel) reenvía a esta ruta solo las visitas de esos bots (ver vercel.json),
// o se puede compartir directamente https://<backend>/share/event/<id>.

const router = express.Router();

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DEFAULT_TITLE = "Kiu — Hagamos algo";
const DEFAULT_DESCRIPTION = "Arma un partido, una juntada o lo que quieras en menos de un minuto. Descubre planes cerca tuyo.";

const describirEvento = (ev) => {
  const partes = [formatFechaHora(ev.date)];
  partes.push(ev.comuna ? `${ev.location}, ${ev.comuna}` : ev.location);
  const quedan = ev.maxParticipants - totalParticipantes(ev);
  if (quedan <= 0) partes.push("Sin cupos");
  else partes.push(quedan === 1 ? "Queda 1 cupo" : `Quedan ${quedan} cupos`);
  partes.push(ev.cost ? `$${ev.cost} por persona` : "Gratis");
  return partes.join(" · ");
};

export const renderPreview = ({ title, description, url }) => {
  const image = `${frontendUrl()}/og-image.jpg`;
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url), i = escapeHtml(image);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kiu">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="es_CL">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${u}">
</head>
<body>
<p><a href="${u}">${t}</a></p>
</body>
</html>`;
};

// GET /share/event/:id
router.get("/event/:id", async (req, res) => {
  const url = eventLink(encodeURIComponent(req.params.id));
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  try {
    if (mongoose.isValidObjectId(req.params.id)) {
      const ev = await Event.findById(req.params.id)
        .select("title date location comuna maxParticipants participants manualParticipants cost")
        .lean();
      if (ev) {
        title = `${ev.title} · Kiu`;
        description = describirEvento(ev);
      }
    }
  } catch (err) {
    console.error("Error armando vista previa:", err);
  }
  // Cache corto: los cupos cambian, pero los bots no necesitan el dato al segundo
  res.set("Cache-Control", "public, max-age=300");
  res.type("html").send(renderPreview({ title, description, url }));
});

export default router;
