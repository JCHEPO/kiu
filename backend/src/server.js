import "dotenv/config";
import { JWT_SECRET } from "./config.js"; // corta el arranque si falta JWT_SECRET
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import canchasRoutes from "./routes/canchas.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import shareRoutes from "./routes/share.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import { enviarRecordatorios } from "./jobs/recordatorios.js";
import { reportarError } from "./utils/alertas.js";
import User from "./models/User.js";

// Errores que nadie atrapó: se registran (y se avisan por email si hay ALERT_EMAIL).
// Ante una excepción no atrapada el proceso queda en estado dudoso: se cierra y el host lo reinicia.
process.on("unhandledRejection", (reason) => reportarError("proceso", reason));
process.on("uncaughtException", (err) => {
  reportarError("proceso", err);
  setTimeout(() => process.exit(1), 1000); // da tiempo a enviar la alerta
});

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/petu");

const app = express();
// Detrás de un proxy (Render, etc.) para que rate-limit vea la IP real del cliente
app.set("trust proxy", 1);
app.use(helmet());
const corsOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
  origin: corsOrigin,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "100kb" }));

// Toda respuesta 5xx queda registrada (las rutas responden 500 en sus propios catch)
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 500 && !res.locals.errorReportado) {
      reportarError("servidor", new Error(`${req.method} ${req.baseUrl || ""}${req.path} respondió ${res.statusCode}`), { status: res.statusCode });
    }
  });
  next();
});

// Estado del servicio, para un monitor externo (UptimeRobot, Better Stack, etc.)
app.get("/api/health", (req, res) => {
  const db = mongoose.connection.readyState === 1 ? "conectada" : "desconectada";
  res.status(db === "conectada" ? 200 : 503).json({ ok: db === "conectada", db, uptime: Math.round(process.uptime()) });
});

// Errores del navegador (ver frontend/src/utils/reportarError.js). Con límite por IP.
const clientErrorLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.post("/api/client-errors", clientErrorLimiter, (req, res) => {
  const { message, stack, url, userAgent } = req.body || {};
  if (typeof message === "string" && message.trim()) {
    reportarError("navegador", { message: message.slice(0, 300), stack: typeof stack === "string" ? stack : "" }, {
      url: typeof url === "string" ? url.slice(0, 300) : "",
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 200) : ""
    });
  }
  res.status(204).end();
});

// Socket.IO setup
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET", "POST", "PUT", "DELETE"] }
});

// Make io accessible to routes via req.app
app.set("io", io);

// Si el cliente manda un JWT en el handshake, identificamos el socket.
// Conexiones anónimas se permiten, pero no reciben nada: las actualizaciones de un evento traen
// nombres y mensajes del muro, que solo ve quien inició sesión.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.data.userId = jwt.verify(token, JWT_SECRET).id;
    } catch {
      // token inválido → sigue como anónimo
    }
  }
  next();
});

io.on("connection", (socket) => {
  // Sala de un evento (actualizaciones en tiempo real): solo usuarios autenticados.
  // El prefijo "event-" separa estas salas de las personales ("user-<id>"): sin él, alguien podría
  // pedir unirse al "evento" user-<id> de otra persona y recibir sus notificaciones.
  socket.on("join-event", (eventId) => {
    if (socket.data.userId && mongoose.isValidObjectId(eventId)) socket.join(`event-${eventId}`);
  });

  socket.on("leave-event", (eventId) => {
    if (mongoose.isValidObjectId(eventId)) socket.leave(`event-${eventId}`);
  });

  // Join user room (notificaciones): solo la sala del usuario autenticado en el handshake.
  // No se confía en ids enviados por el cliente.
  socket.on("join-user", () => {
    if (socket.data.userId) socket.join(`user-${socket.data.userId}`);
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/canchas", canchasRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/share", shareRoutes); // vistas previas para WhatsApp y otros (ver share.routes.js)

// --- Recordatorios antes de cada evento ---
// Corre cada 10 minutos mientras el servidor esté encendido.
const correrRecordatorios = () =>
  enviarRecordatorios(io).catch((err) => console.error("Error en recordatorios:", err));
mongoose.connection.once("open", () => {
  // Género: "LGTBQ+" pasó a ser "Otro" ("Otro o prefiero no decir"). Se convierte una vez; no hace nada si ya no quedan.
  User.updateMany({ genero: "LGTBQ+" }, { $set: { genero: "Otro" } })
    .then((r) => { if (r.modifiedCount) console.log(`Género actualizado a "Otro" en ${r.modifiedCount} usuarios`); })
    .catch((err) => reportarError("servidor", err));
  correrRecordatorios();
  setInterval(correrRecordatorios, 10 * 60 * 1000);
});

// Si el host apaga el servidor cuando no hay tráfico (p.ej. Render gratis), un cron externo
// puede llamar a esta ruta cada 10-15 min. Solo existe si se define CRON_SECRET.
app.post("/api/internal/recordatorios", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(404).json({ error: "No encontrado" });
  if (req.get("x-cron-secret") !== secret) return res.status(401).json({ error: "No autorizado" });
  try {
    const enviados = await enviarRecordatorios(io);
    res.json({ enviados });
  } catch (err) {
    console.error("Error en recordatorios:", err);
    res.status(500).json({ error: "Error al enviar recordatorios" });
  }
});

// Errores que llegan a Express sin respuesta (p.ej. un JSON mal formado)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "La solicitud es demasiado grande" });
  reportarError("servidor", err, { ruta: `${req.method} ${req.originalUrl}` });
  res.locals.errorReportado = true;
  res.status(500).json({ error: "Error interno" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on ${PORT}`));
