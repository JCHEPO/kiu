import "dotenv/config";
import { JWT_SECRET } from "./config.js"; // corta el arranque si falta JWT_SECRET
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import canchasRoutes from "./routes/canchas.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import shareRoutes from "./routes/share.routes.js";
import { enviarRecordatorios } from "./jobs/recordatorios.js";

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
app.use(express.json());

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
app.use("/share", shareRoutes); // vistas previas para WhatsApp y otros (ver share.routes.js)

// --- Recordatorios antes de cada evento ---
// Corre cada 10 minutos mientras el servidor esté encendido.
const correrRecordatorios = () =>
  enviarRecordatorios(io).catch((err) => console.error("Error en recordatorios:", err));
mongoose.connection.once("open", () => {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on ${PORT}`));
