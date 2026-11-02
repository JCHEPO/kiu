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
| `GOOGLE_CLIENT_ID` | Para login con Google | El mismo Client ID que `VITE_GOOGLE_CLIENT_ID`. El backend rechaza tokens de otras apps. Sin esta variable, el login con Google queda desactivado |
| `FACEBOOK_APP_ID` | Para login con Facebook | El mismo App ID que `VITE_FACEBOOK_APP_ID`. Sin esta variable, el login con Facebook queda desactivado |
| `APP_TIMEZONE` | No | Zona horaria de las fechas en avisos y vistas previas (default `America/Santiago`) |
| `CRON_SECRET` | No | Activa `POST /api/internal/recordatorios` para un cron externo (header `x-cron-secret`) |
| `ALERT_EMAIL` | No | Email que recibe un aviso cuando hay errores del servidor o del navegador (máx. 1 por error cada 15 min y 20 por día). Necesita SMTP |
| `BACKUP_DIR` / `BACKUP_KEEP` | No | Carpeta de los respaldos (default `backups`) y cuántas copias guardar (default `8`) |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # y editar los valores
npm run dev            # corre en http://localhost:5173
```

Variables de `frontend/.env`: `VITE_API_URL` (URL del backend), `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID` (el login con Facebook requiere HTTPS), `VITE_SITE_URL` (URL pública del frontend, para la imagen de vista previa). Los botones de Google y Facebook solo aparecen si su variable está definida.

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

### Monitoreo de errores

- `GET /api/health` responde `200` si el servidor y la base de datos están bien, o `503` si no. Conviene configurar un monitor gratuito (UptimeRobot, Better Stack) que la revise cada 5 minutos y te avise si falla. En Render gratis, ese chequeo además evita que el servidor se apague por falta de tráfico.
- Toda respuesta con error 5xx, los errores no atrapados del proceso y los errores del navegador (`POST /api/client-errors`) quedan en los logs como `[error:...]`. Con `ALERT_EMAIL` también llegan por correo.

### Respaldo de la base de datos

En MongoDB Atlas, activa el respaldo del clúster (incluso en el plan gratis: una copia diaria, guarda las últimas cuatro). Además, saca una copia propia de vez en cuando (por ejemplo, cada semana):

```bash
cd backend
npm run respaldo                                          # → backups/kiu-AAAA-MM-DDTHH-MM/
npm run restaurar -- backups/kiu-2026-11-02T10-00 --confirmar   # reemplaza la base por ese respaldo
```

Los respaldos tienen datos personales: `backups/` está en `.gitignore`. Guárdalos en un lugar privado y no los compartas. Antes de restaurar en producción, prueba con otra base (`MONGO_URI=.../kiu-prueba`).

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
- Términos y condiciones (`/terminos`) y Política de privacidad (`/privacidad`); al registrarse se guarda la aceptación (fecha y versión). Edad mínima: 18 años
- Perfil: descargar mis datos (JSON) y borrar mi cuenta (borra eventos propios, mensajes, inscripciones y avisos)
- Reportar usuarios y eventos; el admin los revisa en el panel y puede sumar un strike
- Panel admin → Métricas del piloto: organizadores que repiten, eventos que llegan al mínimo, conversión de links compartidos y conteos semanales (registro propio, sin cookies ni servicios externos)
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
- `GET /api/auth/me/datos` (copia de mis datos) · `DELETE /api/auth/me` (body `{ password }` o `{ confirmacion: "BORRAR" }`)
- `POST /api/reports` (`{ tipo: "usuario" | "evento", id, motivo, detalle? }`) · `GET/PATCH /api/admin/reports` · `GET /api/admin/metrics`
- `GET /api/health` · `POST /api/client-errors`
- `POST /api/auth/register|login|google|facebook|forgot-password|reset-password` · `GET/PATCH /api/auth/me`
