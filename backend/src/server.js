import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/petu");

const app = express();
const corsOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Socket.IO setup
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET", "POST", "PUT", "DELETE"] }
});

// Make io accessible to routes via req.app
app.set("io", io);

io.on("connection", (socket) => {
  // Join event room (for real-time event updates)
  socket.on("join-event", (eventId) => {
    socket.join(eventId);
  });

  socket.on("leave-event", (eventId) => {
    socket.leave(eventId);
  });

  // Join user room (for real-time notifications)
  socket.on("join-user", (userId) => {
    socket.join(`user-${userId}`);
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/notifications", notificationsRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on ${PORT}`));
