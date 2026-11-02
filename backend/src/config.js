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
