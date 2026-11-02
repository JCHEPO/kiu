// Configuración compartida del backend.
// Este módulo se importa después de "dotenv/config" (ver server.js), así que process.env ya está cargado.

// JWT_SECRET es obligatorio: con un valor por defecto conocido, cualquiera podría firmar
// tokens válidos y hacerse pasar por cualquier usuario, incluido un admin.
if (!process.env.JWT_SECRET) {
  console.error("❌ Falta JWT_SECRET. Definilo en backend/.env (local) o en las variables de entorno del host (producción) y volvé a iniciar el servidor.");
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn("⚠️  JWT_SECRET es corto. Usá al menos 32 caracteres aleatorios.");
}

export const JWT_SECRET = process.env.JWT_SECRET;

// Duración de la sesión. Al vencer, el usuario tiene que volver a iniciar sesión.
export const JWT_EXPIRES_IN = "30d";

// Términos y política de privacidad: al cambiar su texto, actualizar esta versión (fecha).
// Se guarda junto a la fecha en que cada usuario los aceptó.
export const TERMINOS_VERSION = "2026-11-02";

// Edad mínima para crear una cuenta (debe coincidir con frontend/src/config/legal.js)
export const EDAD_MINIMA = 18;

// Géneros que se pueden elegir. "LGTBQ+" es el valor antiguo de "Otro": se acepta y se convierte.
export const GENEROS_VALIDOS = ["Hombre", "Mujer", "Otro"];
export const normalizarGenero = (g) => (g === "LGTBQ+" ? "Otro" : g);
