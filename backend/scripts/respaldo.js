// Respaldo de la base de datos en archivos JSON (formato EJSON: conserva fechas e ids).
//
//   cd backend
//   npm run respaldo                 → backups/kiu-AAAA-MM-DDTHH-MM/<colección>.json
//
// Usa MONGO_URI de backend/.env. Guarda las últimas 8 copias y borra las más viejas.
// Los respaldos tienen datos personales: la carpeta backups/ está en .gitignore. No la subas a GitHub
// ni la compartas; guárdala en un lugar privado (p.ej. una carpeta de Google Drive solo tuya).
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const EJSON = mongoose.mongo.BSON.EJSON;
const CARPETA = path.resolve(process.env.BACKUP_DIR || "backups");
const MANTENER = Number(process.env.BACKUP_KEEP) || 8;

// Exporta cada colección de `db` a <dir>/<colección>.json. Devuelve { colección: cantidad }.
export async function respaldar(db, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const colecciones = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  const resumen = {};
  for (const nombre of colecciones) {
    const docs = await db.collection(nombre).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${nombre}.json`), EJSON.stringify(docs, { relaxed: false }));
    resumen[nombre] = docs.length;
  }
  fs.writeFileSync(path.join(dir, "_resumen.json"), JSON.stringify({ fecha: new Date().toISOString(), colecciones: resumen }, null, 2));
  return resumen;
}

// Borra las copias más viejas, dejando las `mantener` más recientes
export function limpiarViejos(carpeta, mantener) {
  if (!fs.existsSync(carpeta)) return [];
  const copias = fs.readdirSync(carpeta).filter((n) => n.startsWith("kiu-")).sort();
  const borrar = copias.slice(0, Math.max(0, copias.length - mantener));
  borrar.forEach((n) => fs.rmSync(path.join(carpeta, n), { recursive: true, force: true }));
  return borrar;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Falta MONGO_URI en backend/.env");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    const sello = new Date().toISOString().slice(0, 16).replace(":", "-");
    const destino = path.join(CARPETA, `kiu-${sello}`);
    const resumen = await respaldar(mongoose.connection.db, destino);
    const borrados = limpiarViejos(CARPETA, MANTENER);
    console.log(`Respaldo listo en ${destino}`);
    Object.entries(resumen).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
    if (borrados.length) console.log(`Se borraron ${borrados.length} copias viejas`);
  } catch (err) {
    console.error("Error en el respaldo:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
