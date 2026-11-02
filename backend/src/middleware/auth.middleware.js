import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { JWT_SECRET } from "../config.js";

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

// Como authenticate, pero sin bloquear: si hay un token válido de un usuario activo deja req.user;
// si no hay token (o no sirve), sigue como visitante anónimo. Para rutas públicas que muestran más
// información a quien inició sesión.
export const optionalAuth = async (req, res, next) => {
	const auth = req.headers.authorization;
	const parts = auth ? auth.split(" ") : [];
	if (parts.length !== 2 || parts[0] !== "Bearer") return next();
	try {
		const payload = jwt.verify(parts[1], JWT_SECRET);
		const user = await User.findById(payload.id).select("activo");
		if (user && user.activo !== false) req.user = payload;
	} catch {
		// token inválido o vencido → anónimo
	}
	next();
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
