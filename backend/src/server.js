import "dotenv/config";
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

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET no está definido; se usa un valor inseguro por defecto. Definilo en backend/.env o en el host antes de producción.");
}

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
// Conexiones anónimas se permiten (los eventos son públicos), pero sin sala personal.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.data.userId = jwt.verify(token, process.env.JWT_SECRET || "supersecret").id;
    } catch {
      // token inválido → sigue como anónimo
    }
  }
  next();
});

io.on("connection", (socket) => {
  // Join event room (for real-time event updates) — datos públicos
  socket.on("join-event", (eventId) => {
    if (typeof eventId === "string") socket.join(eventId);
  });

  socket.on("leave-event", (eventId) => {
    if (typeof eventId === "string") socket.leave(eventId);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on ${PORT}`));
