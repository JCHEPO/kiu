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
| `JWT_SECRET` | **Sí** | Secreto para firmar tokens (32+ caracteres aleatorios; nunca subirlo a git). El servidor no arranca sin ella |
| `PORT` | No | Puerto del backend (default `3000`) |
| `FRONTEND_URL` | Sí (prod) | Origen permitido por CORS y base de los links en emails y vistas previas |
| `SMTP_HOST/PORT/USER/PASS/FROM` | No | Emails de "recuperar contraseña" y avisos de eventos. Van en `backend/.env`. Sin SMTP, los correos se imprimen en la consola |
| `APP_TIMEZONE` | No | Zona horaria de las fechas en avisos y vistas previas (default `America/Santiago`) |
| `CRON_SECRET` | No | Activa `POST /api/internal/recordatorios` para un cron externo (header `x-cron-secret`) |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # y editar los valores
npm run dev            # corre en http://localhost:5173
```

Variables de `frontend/.env`: `VITE_API_URL` (URL del backend), `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID` (el login con Facebook requiere HTTPS), `VITE_SITE_URL` (URL pública del frontend, para la imagen de vista previa).

### Vista previa en WhatsApp

WhatsApp, Facebook e iMessage leen las etiquetas `og:` del HTML sin ejecutar JavaScript, así que no ven los datos de cada evento. El backend tiene `GET /share/event/:id`, que responde un HTML con el nombre, la fecha, el lugar y los cupos del evento, y redirige a las personas a la página real.

Para que los links normales (`https://<frontend>/event/<id>`) muestren esa vista previa en Vercel, agregar esta regla **antes** de la regla general en `frontend/vercel.json` (con la URL real del backend):

```json
{
  "source": "/event/:id",
  "has": [{ "type": "header", "key": "user-agent", "value": ".*(WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot).*" }],
  "destination": "https://<backend>/share/event/:id"
}
```

### Avisos

Los participantes reciben avisos en la app y por email cuando: falta poco para el evento (recordatorio unas 3 horas antes), el evento llega al mínimo y queda confirmado, cambia la fecha o el lugar, o se cancela. El creador recibe un aviso en la app cuando alguien se une. El recordatorio corre cada 10 minutos mientras el backend está encendido; si el host lo apaga sin tráfico, configurar `CRON_SECRET` y un cron externo que llame a `POST /api/internal/recordatorios`.

## Funcionalidades

- Registro e inicio de sesion (email, Google, Facebook) + recuperación de contraseña por email
- Crear eventos (Partidos, Juegos de mesa, Evento) con flujo paso a paso: lugar, fecha, costo, cupos y restricción de género
- Detalle de evento con cuenta regresiva, muro de mensajes, lista de items ("¿qué llevamos?") y participantes — con updates en tiempo real (Socket.IO)
- Unirse/salir de eventos, participantes manuales, mínimo de participantes ("se confirma con N")
- "Mis eventos": próximos y pasados, como creador o participante
- Detalle de evento público: sin sesión se ve el evento (sin nombres ni muro) y se pide login solo para unirse
- Avisos en la app y por email: recordatorio, evento confirmado, cambios de fecha o lugar, cancelación; el creador ve quién se une
- "Otro lugar" al crear: cualquier sitio con nombre, comuna y link de Google Maps opcional
- Panel admin: lugares/canchas (con geocoding), usuarios (banear, verificar, strikes), eventos
- Perfil de usuario editable + verificación de cuenta

## Seguridad

- Rate limiting en login/registro/recuperación (`express-rate-limit`)
- Cabeceras de seguridad con `helmet`
- Validación server-side en registro, login y creación de eventos
- Usuarios baneados: bloqueados en el login y en cada request autenticado
- Los emails de los usuarios nunca se envían a otros usuarios (eventos, participantes, mensajes)
- Las actualizaciones en tiempo real de un evento solo llegan a usuarios con sesión

## API principal (resumen)

- `GET /api/events?page=1&limit=50` → `{ events, total, page, pages }` (solo eventos futuros, orden por fecha)
- `GET /api/events/mine` → eventos donde soy creador o participante (requiere token)
- `POST /api/events` · `GET/PUT/DELETE /api/events/:id` · `POST /api/events/:id/join|leave|messages|items`
- `GET /api/events/:id` sin token → vista pública `{ ..., participantCount, isPublicView: true }`
- `GET /share/event/:id` → HTML con etiquetas `og:` para vistas previas
- `POST /api/auth/register|login|google|facebook|forgot-password|reset-password` · `GET/PATCH /api/auth/me`
