# Kiu

Plataforma web para crear y descubrir eventos en tu comunidad. Organiza partidos, juegos de mesa, clases y mas con tus vecinos.

## Stack

- **Frontend:** React 18 + Vite + React Router (estilos inline, sin CSS externo)
- **Backend:** Express + Mongoose + JWT + bcrypt + Socket.IO (tiempo real)
- **Base de datos:** MongoDB
- **Auth:** email/contraseña, Google OAuth y Facebook OAuth

## Requisitos

- **Node.js 18 o superior** (el backend usa `fetch` global)
- MongoDB local (`mongodb://127.0.0.1:27017`) o un cluster de Atlas

## Estructura

```
frontend/
  src/
    pages/          # HomePage, CreateEventPage, EventDetailPage, MyEventsPage,
                    # ProfilePage, AdminPage, ResetPasswordPage
    context/        # AuthContext (auth, login, logout, fetchWithAuth)
    app.jsx         # Rutas principales
    main.jsx        # Entry point

backend/
  src/
    models/         # User, Event, Cancha, Notification
    routes/         # auth, events, canchas, notifications, admin
    middleware/     # auth.middleware (JWT + chequeo de baneo, roles)
    utils/          # email.js (nodemailer, con fallback a consola)
    server.js       # Entry point (Express + Socket.IO + helmet + CORS)
```

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # y editar los valores
npm start              # corre en http://localhost:3000
```

Variables de `backend/.env`:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MONGO_URI` | Sí (prod) | Conexión a MongoDB. Default local: `mongodb://127.0.0.1:27017/petu` |
| `JWT_SECRET` | **Sí** | Secreto para firmar tokens. Largo y aleatorio; nunca subirlo a git |
| `PORT` | No | Puerto del backend (default `3000`) |
| `FRONTEND_URL` | Sí (prod) | Origen permitido por CORS y base de los links de reseteo |
| `SMTP_HOST/PORT/USER/PASS/FROM` | No | Para el email de "recuperar contraseña". Sin SMTP, el link se imprime en la consola |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # y editar los valores
npm run dev            # corre en http://localhost:5173
```

Variables de `frontend/.env`: `VITE_API_URL` (URL del backend), `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID` (el login con Facebook requiere HTTPS).

## Funcionalidades

- Registro e inicio de sesion (email, Google, Facebook) + recuperación de contraseña por email
- Crear eventos (Partidos, Juegos de mesa, Evento) con flujo paso a paso: lugar, fecha, costo, cupos y restricción de género
- Detalle de evento con cuenta regresiva, muro de mensajes, lista de items ("¿qué llevamos?") y participantes — con updates en tiempo real (Socket.IO)
- Unirse/salir de eventos, participantes manuales, mínimo de participantes ("se confirma con N")
- "Mis eventos": próximos y pasados, como creador o participante
- Notificaciones cuando el creador cambia fecha o lugar
- Panel admin: lugares/canchas (con geocoding), usuarios (banear, verificar, strikes), eventos
- Perfil de usuario editable + verificación de cuenta

## Seguridad

- Rate limiting en login/registro/recuperación (`express-rate-limit`)
- Cabeceras de seguridad con `helmet`
- Validación server-side en registro, login y creación de eventos
- Usuarios baneados: bloqueados en el login y en cada request autenticado

## API principal (resumen)

- `GET /api/events?page=1&limit=50` → `{ events, total, page, pages }` (solo eventos futuros, orden por fecha)
- `GET /api/events/mine` → eventos donde soy creador o participante (requiere token)
- `POST /api/events` · `GET/PUT/DELETE /api/events/:id` · `POST /api/events/:id/join|leave|messages|items`
- `POST /api/auth/register|login|google|facebook|forgot-password|reset-password` · `GET/PATCH /api/auth/me`
