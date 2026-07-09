import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

// Solo creamos el transporter si hay SMTP configurado.
// Sin config, sendEmail cae a un fallback que imprime el contenido en consola (útil en dev).
let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // 465 = SSL; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

export const isEmailConfigured = () => !!transporter;

// Envía un email. Devuelve { fallback: true } si no había SMTP y se imprimió en consola.
export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`[email:fallback] Para: ${to}\nAsunto: ${subject}\n${text || html || ""}`);
    return { fallback: true };
  }
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text, html });
  return { fallback: false };
}
