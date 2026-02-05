import mongoose from "mongoose";
import Event from "./src/models/Event.js";
import User from "./src/models/User.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/petu";

// Sunday 2026-02-08 at different times
const sunday = new Date("2026-02-08");

const testEvents = [
  {
    title: "Partido de Futbol",
    date: new Date(sunday.getTime() + 10 * 60 * 60 * 1000), // 10:00
    description: "Partido amistoso en la cancha del parque. Traer agua y buena onda!",
    location: "Cancha Municipal, Concepcion",
    maxParticipants: 14,
    category: "Partido",
    subcategory: "Futbol",
    cost: 2000,
    restriccionGenero: "Mixto"
  },
  {
    title: "Asado en la terraza",
    date: new Date(sunday.getTime() + 13 * 60 * 60 * 1000), // 13:00
    description: "Asado dominguero para cerrar el finde. Cada uno trae algo para la parrilla.",
    location: "Edificio Los Aromos, San Pedro",
    maxParticipants: 12,
    category: "Social",
    subcategory: "",
    cost: 5000,
    restriccionGenero: "Mixto"
  },
  {
    title: "Meetup de programadores",
    date: new Date(sunday.getTime() + 16 * 60 * 60 * 1000), // 16:00
    description: "Juntemonos a compartir proyectos y conocer gente del rubro tech!",
    location: "Cafe Moskito, Concepcion",
    maxParticipants: 20,
    category: "Social",
    subcategory: "",
    cost: 0,
    restriccionGenero: "Mixto"
  },
  {
    title: "Taller de cafe de especialidad",
    date: new Date(sunday.getTime() + 11 * 60 * 60 * 1000), // 11:00
    description: "Aprende sobre origenes, tueste y metodos de preparacion. Incluye degustacion.",
    location: "Cafe La Flor, Concepcion",
    maxParticipants: 8,
    category: "Social",
    subcategory: "",
    cost: 15000,
    restriccionGenero: "Mixto"
  },
  {
    title: "Noche de cartas Pokemon",
    date: new Date(sunday.getTime() + 18 * 60 * 60 * 1000), // 18:00
    description: "Torneo casual de Pokemon TCG. Trae tu mazo y snacks para compartir!",
    location: "Tienda Mana, Concepcion",
    maxParticipants: 16,
    category: "Social",
    subcategory: "",
    cost: 3000,
    restriccionGenero: "Mixto"
  },
  {
    title: "Brunch dominguero",
    date: new Date(sunday.getTime() + 12 * 60 * 60 * 1000), // 12:00
    description: "Brunch tranqui para conocer gente nueva. Cafe, tostadas y buena conversa.",
    location: "Cafe Origen, Hualpen",
    maxParticipants: 10,
    category: "Social",
    subcategory: "",
    cost: 8000,
    restriccionGenero: "Mixto"
  },
  {
    title: "Clase de yoga al aire libre",
    date: new Date(sunday.getTime() + 9 * 60 * 60 * 1000), // 09:00
    description: "Sesion de yoga para principiantes en el parque. Trae tu mat!",
    location: "Parque Ecuador, Concepcion",
    maxParticipants: 15,
    category: "Social",
    subcategory: "",
    cost: 0,
    restriccionGenero: "Mixto"
  },
  {
    title: "Junta de cumple sorpresa",
    date: new Date(sunday.getTime() + 20 * 60 * 60 * 1000), // 20:00
    description: "Fiesta sorpresa para Cami! Traer regalo y buena vibra. No le cuenten!",
    location: "Casa de Pedro, Chiguayante",
    maxParticipants: 25,
    category: "Social",
    subcategory: "",
    cost: 5000,
    restriccionGenero: "Mixto"
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Conectado a MongoDB");

    // Find or create a test user
    let testUser = await User.findOne({ email: "test@kiu.cl" });
    if (!testUser) {
      testUser = await User.create({
        email: "test@kiu.cl",
        nombre: "Usuario",
        apellido: "Test",
        genero: "Hombre",
        password: "$2b$10$abcdefghijklmnopqrstuv" // dummy hash
      });
      console.log("Usuario test creado");
    }

    // Delete existing test events (optional - to avoid duplicates)
    await Event.deleteMany({ creator: testUser._id });
    console.log("Eventos anteriores eliminados");

    // Create new events
    for (const eventData of testEvents) {
      const event = await Event.create({
        ...eventData,
        creator: testUser._id,
        participants: [testUser._id],
        messages: [],
        items: []
      });
      console.log(`Evento creado: ${event.title}`);
    }

    console.log("\n8 eventos creados exitosamente para el domingo 2026-02-08!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

seed();
