import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import Event from "../models/Event.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { sendEmail } from "../utils/email.js";
import { JWT_SECRET, JWT_EXPIRES_IN, TERMINOS_VERSION, EDAD_MINIMA, GENEROS_VALIDOS, normalizarGenero } from "../config.js";
import { registrarActividad } from "../utils/actividad.js";
import { vincularRegistro } from "../utils/seguimiento.js";
import Strike from "../models/Strike.js";
import { notify } from "../utils/notify.js";
import { MAX_ACTIVOS, DIAS_VIGENCIA, filtroActivos } from "../utils/strikes.js";
import { eliminarCuenta, exportarDatos } from "../utils/cuentas.js";

const router = express.Router();

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
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." }
});
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Probá de nuevo en unos minutos." }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Texto opcional (o requerido) de hasta `max` caracteres
const textoValido = (v, max, requerido = false) =>
  v === undefined || v === null || v === "" ? !requerido : typeof v === "string" && v.trim().length <= max && (!requerido || v.trim().length > 0);

// Años cumplidos a hoy
const edadEn = (fecha) => {
  const n = new Date(fecha), hoy = new Date();
  let edad = hoy.getUTCFullYear() - n.getUTCFullYear();
  const m = hoy.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && hoy.getUTCDate() < n.getUTCDate())) edad--;
  return edad;
};

router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, password, nombre, apellido, fechaNacimiento, aceptaTerminos } = req.body;
    const genero = normalizarGenero(req.body.genero);

    const cleanEmail = typeof email === "string" ? email.trim() : "";
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: "Email inválido" });
    if (typeof password !== "string" || password.length < 6)
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    if (!textoValido(nombre, 50, true))
      return res.status(400).json({ error: "Ingresa tu nombre (máx 50 caracteres)" });
    if (!textoValido(apellido, 50))
      return res.status(400).json({ error: "El apellido es demasiado largo" });
    if (genero && !GENEROS_VALIDOS.includes(genero))
      return res.status(400).json({ error: "Género inválido" });
    if (fechaNacimiento && isNaN(new Date(fechaNacimiento).getTime()))
      return res.status(400).json({ error: "Fecha de nacimiento inválida" });
    if (fechaNacimiento && edadEn(fechaNacimiento) < EDAD_MINIMA)
      return res.status(400).json({ error: `Debes tener al menos ${EDAD_MINIMA} años para usar Kiu` });
    if (aceptaTerminos !== true)
      return res.status(400).json({ error: "Debes aceptar los Términos y la Política de privacidad" });

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(400).json({ error: "Email ya registrado" });

    const hash = await bcrypt.hash(password, 10);
    const nuevo = await User.create({
      email: cleanEmail, password: hash, nombre: nombre.trim(), apellido: typeof apellido === "string" ? apellido.trim() : "",
      genero, fechaNacimiento, aceptaTerminosAt: new Date(), terminosVersion: TERMINOS_VERSION
    });
    registrarActividad("registro", { user: nuevo._id });
    // Si llegó por un link compartido, queda asociado (métrica de links que terminan en inscripción)
    await vincularRegistro(req.body.visita, nuevo._id);

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

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, rol: user.rol } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// Helper to build the user response object
const buildUserResponse = (user) => ({
  token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
  user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, rol: user.rol }
});

// Google OAuth
// Hay que comprobar que el token fue emitido para Kiu (GOOGLE_CLIENT_ID). Si no, cualquier otra app
// con acceso a la cuenta de Google de alguien podría usar ese token para entrar a Kiu como esa persona.
router.post("/google", authLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: "El inicio de sesión con Google no está disponible" });
    }
    if (typeof accessToken !== "string" || !accessToken) {
      return res.status(400).json({ error: "Falta el token de Google" });
    }

    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    const info = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok || info.aud !== clientId) {
      return res.status(401).json({ error: "Token de Google inválido" });
    }

    // Use Google userinfo endpoint to get user data from access_token
    const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await googleRes.json();
    if (payload.error) {
      return res.status(401).json({ error: "Token de Google inválido" });
    }
    const { sub: googleId, email, given_name, family_name } = payload;
    // Solo emails verificados: con uno sin verificar se podría tomar la cuenta Kiu de otra persona con ese email
    if (!email || payload.email_verified !== true) {
      return res.status(400).json({ error: "Tu cuenta de Google no tiene un email verificado" });
    }

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
      registrarActividad("registro", { user: user._id });
      await vincularRegistro(req.body.visita, user._id);
    }

    if (user.activo === false) return res.status(403).json({ error: "Cuenta suspendida" });

    res.json(buildUserResponse(user));
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Error al autenticar con Google" });
  }
});

// Facebook OAuth
// Igual que con Google: el token tiene que ser de la app de Kiu (FACEBOOK_APP_ID).
router.post("/facebook", authLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      return res.status(503).json({ error: "El inicio de sesión con Facebook no está disponible" });
    }
    if (typeof accessToken !== "string" || !accessToken) {
      return res.status(400).json({ error: "Falta el token de Facebook" });
    }
    const token = encodeURIComponent(accessToken);

    // ¿De qué app es este token?
    const appRes = await fetch(`https://graph.facebook.com/app?access_token=${token}`);
    const appData = await appRes.json().catch(() => ({}));
    if (!appRes.ok || String(appData.id) !== String(appId)) {
      return res.status(401).json({ error: "Token de Facebook inválido" });
    }

    // Verify token with Facebook Graph API
    const fbRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,first_name,last_name&access_token=${token}`);
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
      registrarActividad("registro", { user: user._id });
      await vincularRegistro(req.body.visita, user._id);
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
    // Después de entrar con Google o Facebook: el nombre a mostrar y la aceptación de los términos
    const { nombre, aceptaTerminos } = req.body;
    if (!textoValido(nombre, 50, true))
      return res.status(400).json({ error: "Ingresa tu nombre o apodo (máx 50 caracteres)" });
    const update = { nombre: nombre.trim() };
    if (aceptaTerminos === true) {
      update.aceptaTerminosAt = new Date();
      update.terminosVersion = TERMINOS_VERSION;
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
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
    res.json({ user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento, telefono: user.telefono, verificado: user.verificado, solicitaVerificacion: user.solicitaVerificacion, rol: user.rol, tienePassword: !!user.password, strikes: user.strikes || 0, suspendidoHasta: user.suspendidoHasta && user.suspendidoHasta > new Date() ? user.suspendidoHasta : null } });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// PATCH /api/auth/me - actualizar perfil
router.patch("/me", authenticate, async (req, res) => {
  try {
    const { nombre, apellido, fechaNacimiento, telefono } = req.body;
    const genero = normalizarGenero(req.body.genero);
    if (genero && !GENEROS_VALIDOS.includes(genero))
      return res.status(400).json({ error: "Género inválido" });
    if (!textoValido(nombre, 50) || !textoValido(apellido, 50) || !textoValido(telefono, 20))
      return res.status(400).json({ error: "Algún dato es demasiado largo" });
    if (fechaNacimiento && isNaN(new Date(fechaNacimiento).getTime()))
      return res.status(400).json({ error: "Fecha de nacimiento inválida" });
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

// GET /api/auth/me/datos - descargar una copia de mis datos (acceso y portabilidad)
router.get("/me/datos", authenticate, async (req, res) => {
  try {
    const datos = await exportarDatos(req.user.id);
    if (!datos) return res.status(404).json({ error: "Usuario no encontrado" });
    res.set("Content-Disposition", `attachment; filename="kiu-mis-datos-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(datos);
  } catch (err) {
    console.error("Error exportando datos:", err);
    res.status(500).json({ error: "Error al preparar tus datos" });
  }
});

// DELETE /api/auth/me - borrar mi cuenta y mis datos
// Confirmación: la contraseña si la cuenta tiene una; si entró con Google o Facebook, escribir "BORRAR".
router.delete("/me", authenticate, deleteLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    if (user.password) {
      const { password } = req.body || {};
      if (typeof password !== "string" || !(await bcrypt.compare(password, user.password)))
        // 403 y no 401: el frontend trata un 401 como sesión vencida y cerraría la sesión
        return res.status(403).json({ error: "Contraseña incorrecta" });
    } else if ((req.body?.confirmacion || "").trim().toUpperCase() !== "BORRAR") {
      return res.status(400).json({ error: 'Escribe BORRAR para confirmar' });
    }

    await eliminarCuenta(user._id, req.app.get("io"), { motivo: "pedido del usuario" });
    res.json({ message: "Tu cuenta y tus datos fueron eliminados" });
  } catch (err) {
    console.error("Error borrando cuenta:", err);
    res.status(500).json({ error: "Error al borrar la cuenta" });
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

// GET /api/auth/me/calendario - código del link de calendario personal (lo crea si no existe)
// POST /api/auth/me/calendario/renovar - cambia el código (el link anterior deja de funcionar)
const nuevoTokenCalendario = () => crypto.randomBytes(24).toString("hex");
router.get("/me/calendario", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("calendarioToken");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    if (!user.calendarioToken) { user.calendarioToken = nuevoTokenCalendario(); await user.save(); }
    res.json({ token: user.calendarioToken });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el calendario" });
  }
});
router.post("/me/calendario/renovar", authenticate, async (req, res) => {
  try {
    const token = nuevoTokenCalendario();
    await User.updateOne({ _id: req.user.id }, { $set: { calendarioToken: token } });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar el link" });
  }
});

// GET /api/auth/me/strikes - mis strikes de los últimos 180 días (activos y pasados) y las reglas
router.get("/me/strikes", authenticate, async (req, res) => {
  try {
    const desde = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const [strikes, activos] = await Promise.all([
      Strike.find({ user: req.user.id, creadoAt: { $gte: desde } }).sort({ creadoAt: -1 }).lean(),
      Strike.countDocuments(filtroActivos(req.user.id))
    ]);
    const ahora = Date.now();
    res.json({
      activos,
      maximo: MAX_ACTIVOS,
      diasVigencia: DIAS_VIGENCIA,
      strikes: strikes.map((k) => ({
        _id: k._id,
        tipo: k.tipo,
        evento: k.eventTitulo,
        eventId: k.event,
        fecha: k.creadoAt,
        vence: k.venceAt,
        activo: !k.anulado && new Date(k.venceAt).getTime() > ahora && k.apelacion?.estado !== "aceptada",
        anulado: k.anulado,
        apelacion: k.apelacion?.estado || "ninguna"
      }))
    });
  } catch (err) {
    console.error("Error al obtener strikes:", err);
    res.status(500).json({ error: "Error al obtener tus strikes" });
  }
});

// POST /api/auth/me/strikes/:id/apelar  { texto } - apelar un strike (una vez por strike). Lo revisa un admin.
router.post("/me/strikes/:id/apelar", authenticate, async (req, res) => {
  try {
    const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
    if (!texto) return res.status(400).json({ error: "Cuéntanos qué pasó" });
    if (texto.length > 500) return res.status(400).json({ error: "El texto es demasiado largo (máx 500 caracteres)" });
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: "Strike no encontrado" });
    const strike = await Strike.findOne({ _id: req.params.id, user: req.user.id });
    if (!strike) return res.status(404).json({ error: "Strike no encontrado" });
    if (strike.anulado) return res.status(400).json({ error: "Este strike ya fue anulado" });
    if (strike.apelacion?.estado && strike.apelacion.estado !== "ninguna") {
      return res.status(400).json({ error: "Ya apelaste este strike" });
    }
    strike.apelacion = { texto, at: new Date(), estado: "pendiente", resueltaAt: null };
    await strike.save();
    res.json({ message: "Apelación enviada. La revisaremos pronto." });

    const admins = await User.find({ rol: "admin" }).select("_id");
    notify(req.app.get("io"), {
      userIds: admins.map((a) => a._id),
      event: null,
      message: `Nueva apelación de strike (${strike.tipo}${strike.eventTitulo ? `: "${strike.eventTitulo}"` : ""})`
    });
  } catch (err) {
    console.error("Error al apelar strike:", err);
    res.status(500).json({ error: "Error al enviar la apelación" });
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
