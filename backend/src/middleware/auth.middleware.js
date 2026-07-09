import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const authenticate = async (req, res, next) => {
	const auth = req.headers.authorization;
	if (!auth) return res.status(401).json({ error: "No autorizado" });

	const parts = auth.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer")
		return res.status(401).json({ error: "Formato de token inválido" });

	const token = parts[1];
	try {
		const payload = jwt.verify(token, JWT_SECRET);
		// Verificar que el usuario siga existiendo y no esté baneado (corta sesiones activas)
		const user = await User.findById(payload.id).select("activo");
		if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
		if (user.activo === false) return res.status(403).json({ error: "Cuenta suspendida" });
		req.user = payload; // payload contiene { id }
		next();
	} catch (err) {
		return res.status(401).json({ error: "Token inválido" });
	}
};

export const authorize = (roles = []) => {
	return async (req, res, next) => {
		try {
			const user = await User.findById(req.user.id);
			if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
			if (roles.length && !roles.includes(user.rol))
				return res.status(403).json({ error: "Acceso denegado" });
			next();
		} catch (err) {
			return res.status(500).json({ error: "Error en autorización" });
		}
	};
};
