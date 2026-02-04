import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

router.post("/register", async (req, res) => {
  const { email, password, nombre, apellido, genero, fechaNacimiento } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "Email ya registrado" });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, password: hash, nombre, apellido, genero, fechaNacimiento });

  res.json({ message: "Usuario creado" });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });
  res.json({ token, user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento } });
});

// Helper to build the user response object
const buildUserResponse = (user) => ({
  token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" }),
  user: { id: user._id, email: user.email, nombre: user.nombre, apellido: user.apellido, genero: user.genero, fechaNacimiento: user.fechaNacimiento }
});

// Google OAuth
router.post("/google", async (req, res) => {
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

    res.json(buildUserResponse(user));
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Error al autenticar con Google" });
  }
});

// Facebook OAuth
router.post("/facebook", async (req, res) => {
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

export default router;
