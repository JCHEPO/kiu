// Restaura un respaldo hecho con scripts/respaldo.js.
//
//   cd backend
//   npm run restaurar -- backups/kiu-2026-11-02T10-00 --confirmar
//
// REEMPLAZA las colecciones de la base de MONGO_URI por las del respaldo (borra lo que hay ahora).
// Para probar sin tocar la base real, usa otra base: MONGO_URI=.../kiu-prueba npm run restaurar -- ...
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const EJSON = mongoose.mongo.BSON.EJSON;

// Reemplaza cada colección de `db` con el contenido de <dir>/<colección>.json. Devuelve { colección: cantidad }.
export async function restaurar(db, dir) {
  const archivos = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && !n.startsWith("_"));
  if (archivos.length === 0) throw new Error(`No hay colecciones en ${dir}`);
  const resumen = {};
  for (const archivo of archivos) {
    const nombre = archivo.replace(/\.json$/, "");
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, archivo), "utf8"), { relaxed: false });
    const col = db.collection(nombre);
    await col.deleteMany({});
    if (docs.length) await col.insertMany(docs);
    resumen[nombre] = docs.length;
  }
  return resumen;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error("Indica la carpeta del respaldo: npm run restaurar -- backups/kiu-AAAA-MM-DDTHH-MM --confirmar");
    process.exit(1);
  }
  if (!process.argv.includes("--confirmar")) {
    console.error("Esto BORRA los datos actuales de la base y los reemplaza por el respaldo.");
    console.error("Si estás seguro, repite el comando agregando --confirmar");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Restaurando ${dir} en la base "${mongoose.connection.db.databaseName}"...`);
    const resumen = await restaurar(mongoose.connection.db, dir);
    Object.entries(resumen).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
    console.log("Listo.");
  } catch (err) {
    console.error("Error al restaurar:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
