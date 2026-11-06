import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String },
  googleId: String,
  facebookId: String,
  nombre: String,
  apellido: String,
  // "Otro" = "Otro o prefiero no decir". "LGTBQ+" queda solo para datos antiguos (server.js los convierte al iniciar).
  genero: { type: String, enum: ["Hombre", "Mujer", "Otro", "LGTBQ+"] },
  fechaNacimiento: { type: Date },
  fechaRegistro: { type: Date, default: Date.now },
  telefono: { type: String },
  verificado: { type: Boolean, default: false },
  solicitaVerificacion: { type: Boolean, default: false },
  rol: { type: String, enum: ["user", "admin"], default: "user" },
  strikes: { type: Number, default: 0 }, // strikes activos (lo recalcula utils/strikes.js)
  // Suspensión temporal por strikes: puede entrar a la app, pero no crear eventos ni unirse
  suspendidoHasta: { type: Date, default: null },
  suspensiones: { type: Number, default: 0 }, // cuántas veces fue suspendido (la segunda dura más)
  // Código secreto del link de calendario (ver routes/calendario.routes.js). Se crea cuando la persona lo pide.
  // Sin valor por defecto: el índice único solo cubre a quienes ya tienen código.
  calendarioToken: { type: String },
  activo: { type: Boolean, default: true },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  // Cuándo aceptó los términos y la política de privacidad, y qué versión
  aceptaTerminosAt: { type: Date },
  terminosVersion: { type: String }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

UserSchema.index({ calendarioToken: 1 }, { unique: true, partialFilterExpression: { calendarioToken: { $type: "string" } } });

// Virtual para nombre completo
UserSchema.virtual("name").get(function() {
  // Ojo: en eventos se cargan usuarios sin el email (no se expone a otros), así que puede no estar
  return this.nombre && this.apellido
    ? `${this.nombre} ${this.apellido}`
    : this.nombre || (this.email ? this.email.split("@")[0] : "");
});

export default mongoose.model("User", UserSchema);
