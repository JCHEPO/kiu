import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

export default router;
