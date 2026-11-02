import { sendEmail } from "./email.js";

// Registro de errores del servidor y del navegador.
// Siempre se escriben en la consola (los logs de Render los guardan). Si se define ALERT_EMAIL,
// además se avisa por correo, con límite para no llenar la bandeja si algo falla en bucle.

const VENTANA_MS = 15 * 60 * 1000; // el mismo error se avisa como máximo una vez cada 15 min
const MAX_POR_DIA = 20;
const ultimos = new Map(); // mensaje → última vez que se avisó
let enviadosHoy = 0;
let diaActual = new Date().toDateString();

const recortar = (s, n) => String(s ?? "").slice(0, n);

export function reportarError(origen, err, contexto = {}) {
  const mensaje = recortar(err?.message || err, 300);
  const registro = {
    nivel: "error",
    origen, // "servidor" | "navegador" | "proceso"
    mensaje,
    stack: recortar(err?.stack, 2000),
    ...contexto,
    at: new Date().toISOString()
  };
  console.error(`[error:${origen}]`, JSON.stringify(registro));

  const destino = process.env.ALERT_EMAIL;
  if (!destino) return;

  const hoy = new Date().toDateString();
  if (hoy !== diaActual) { diaActual = hoy; enviadosHoy = 0; }
  const clave = `${origen}:${mensaje}`;
  const ahora = Date.now();
  if (enviadosHoy >= MAX_POR_DIA || ahora - (ultimos.get(clave) || 0) < VENTANA_MS) return;
  ultimos.set(clave, ahora);
  enviadosHoy++;

  sendEmail({
    to: destino,
    subject: `[Kiu] Error (${origen}): ${recortar(mensaje, 80)}`,
    text: `${JSON.stringify(registro, null, 2)}\n\nPuede haber más errores iguales en los próximos 15 minutos; revisa los logs del servidor.`
  }).catch((e) => console.error("No se pudo enviar la alerta por email:", e.message));
}
