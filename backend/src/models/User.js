import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  nombre: String,
  apellido: String,
  genero: { type: String, enum: ["Hombre", "Mujer", "LGTBQ+"] },
  fechaNacimiento: { type: Date },
  fechaRegistro: { type: Date, default: Date.now },
  strikes: { type: Number, default: 0 },
  activo: { type: Boolean, default: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para nombre completo
UserSchema.virtual("name").get(function() {
  return this.nombre && this.apellido
    ? `${this.nombre} ${this.apellido}`
    : this.nombre || this.email.split("@")[0];
});

export default mongoose.model("User", UserSchema);
