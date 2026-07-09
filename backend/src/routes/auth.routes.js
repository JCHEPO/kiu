import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import Event from "../models/Event.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { sendEmail } from "../utils/email.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// --- Rate limiters (por IP) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." }
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados registros desde esta conexión. Probá más tarde." }
});
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Probá de nuevo en unos minutos." }
});

const GENEROS_VALIDOS = ["Hombre", "Mujer", "LGTBQ+"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, password, nombre, apellido, genero, fechaNacimiento } = req.body;

    const cleanEmail = typeof email === "string" ? email.trim() : "";
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: "Email inválido" });
    if (typeof password !== "string" || password.length < 6)
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    if (genero && !GENEROS_VALIDOS.includes(genero))
      return res.status(400).json({ error: "Género inválido" });
    if (fechaNacimiento && isNaN(new Date(fechaNacimiento).getTime()))
      return res.status(400).json({ error: "Fecha de nacimiento inválida" });

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(400).json({ error: "Email ya registrado" });

    const hash = await bcrypt.hash(password, 10);
    await User.create({ email: cleanEmail, password: hash, nombre, apellido, genero, fechaNacimiento });

    res.json({ message: "Usuario creado" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string")
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });

    const user = await User.findOne({ email: email.trim() });
    // user.password puede no existir (cuentas creadas solo con Google/Facebook)
    if (!user || !user.password) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    if (user.activo === false) return res.status(403).json({ error: "Cuenta suspendida" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, rol: user.rol } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// Helper to build the user response object
const buildUserResponse = (user) => ({
  token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" }),
  user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, rol: user.rol }
});

// Google OAuth
router.post("/google", authLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;

    // Use Google userinfo endpoint to get user data from access_token
    const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await googleRes.json();
    if (payload.error) {
      return res.status(401).json({ error: "Token de Google inválido" });
    }
    const { sub: googleId, email, given_name, family_name } = payload;

    // Find by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Link googleId if user exists by email but doesn't have googleId
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        email,
        googleId,
        nombre: given_name || "",
        apellido: family_name || ""
      });
    }

    if (user.activo === false) return res.status(403).json({ error: "Cuenta suspendida" });

    res.json(buildUserResponse(user));
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Error al autenticar con Google" });
  }
});

// Facebook OAuth
router.post("/facebook", authLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;

    // Verify token with Facebook Graph API
    const fbRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,first_name,last_name&access_token=${accessToken}`);
    const fbData = await fbRes.json();

    if (fbData.error) {
      return res.status(401).json({ error: "Token de Facebook inválido" });
    }

    const { id: facebookId, email, first_name, last_name } = fbData;

    if (!email) {
      return res.status(400).json({ error: "No se pudo obtener el email de Facebook. Asegurate de dar permiso de email." });
    }

    // Find by facebookId or email
    let user = await User.findOne({ $or: [{ facebookId }, { email }] });

    if (user) {
      if (!user.facebookId) {
        user.facebookId = facebookId;
        await user.save();
      }
    } else {
      user = await User.create({
        email,
        facebookId,
        nombre: first_name || "",
        apellido: last_name || ""
      });
    }

    if (user.activo === false) return res.status(403).json({ error: "Cuenta suspendida" });

    res.json(buildUserResponse(user));
  } catch (err) {
    console.error("Facebook auth error:", err);
    res.status(401).json({ error: "Error al autenticar con Facebook" });
  }
});

// Update user nickname
router.patch("/me/nickname", authenticate, async (req, res) => {
  try {
    const { nombre } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { nombre },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento } });
  } catch (err) {
    console.error("Error updating nickname:", err);
    res.status(500).json({ error: "Error al actualizar nombre" });
  }
});

// GET /api/auth/me - datos del usuario autenticado
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, telefono: user.telefono, verificado: user.verificado, rol: user.rol } });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// PATCH /api/auth/me - actualizar perfil
router.patch("/me", authenticate, async (req, res) => {
  try {
    const { nombre, apellido, genero, fechaNacimiento, telefono } = req.body;
    if (genero && !GENEROS_VALIDOS.includes(genero))
      return res.status(400).json({ error: "Género inválido" });
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (apellido !== undefined) update.apellido = apellido;
    if (genero !== undefined) update.genero = genero;
    if (fechaNacimiento !== undefined) update.fechaNacimiento = fechaNacimiento;
    if (telefono !== undefined) update.telefono = telefono;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, telefono: user.telefono, verificado: user.verificado, rol: user.rol } });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
});

// POST /api/auth/me/verificacion - solicitar verificación
router.post("/me/verificacion", authenticate, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { solicitaVerificacion: true }, { new: true });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ message: "Solicitud enviada" });
  } catch (err) {
    res.status(500).json({ error: "Error al enviar solicitud" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", recoveryLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    // typeof string: evita inyección de operadores de Mongo; respuesta neutra igual que abajo
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim()))
      return res.json({ message: "Si el email existe, recibirás instrucciones en breve" });
    const cleanEmail = email.trim();
    const user = await User.findOne({ email: cleanEmail });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetToken = token;
      user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora
      await user.save();
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
      try {
        await sendEmail({
          to: cleanEmail,
          subject: "Recupera tu contraseña — Kiu",
          text: `Recibimos una solicitud para restablecer tu contraseña.\n\nAbrí este enlace para elegir una nueva (válido por 1 hora):\n${resetUrl}\n\nSi no fuiste vos, ignorá este correo.`,
          html: `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
<p><a href="${resetUrl}">Elegir una nueva contraseña</a> (el enlace es válido por 1 hora).</p>
<p>Si no fuiste vos, ignorá este correo.</p>`
        });
      } catch (mailErr) {
        // No revelamos el fallo al cliente; queda registrado para el operador.
        console.error("Error enviando email de reseteo:", mailErr);
      }
    }
    // Siempre responder igual para no revelar si el email existe
    res.json({ message: "Si el email existe, recibirás instrucciones en breve" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", recoveryLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof password !== "string" || password.length < 6)
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    // typeof string: evita inyección de operadores de Mongo ({$gt: ""}) en la query
    if (typeof token !== "string" || !token)
      return res.status(400).json({ error: "Token inválido o expirado" });
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: "Token inválido o expirado" });
    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Error al resetear contraseña" });
  }
});

// GET /api/auth/users/:id/public - Perfil público de un usuario
router.get("/users/:id/public", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("nombre apellido fechaRegistro strikes activo verificado");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const [eventsCreated, eventsParticipated] = await Promise.all([
      Event.countDocuments({ creator: req.params.id }),
      Event.countDocuments({ participants: req.params.id, creator: { $ne: req.params.id } })
    ]);

    res.json({
      nombre: user.nombre,
      apellido: user.apellido,
      fechaRegistro: user.fechaRegistro,
      strikes: user.strikes || 0,
      verificado: user.verificado || false,
      eventsCreated,
      eventsParticipated
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

export default router;
