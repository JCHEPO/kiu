import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "";

// Load Facebook SDK once
let fbSdkLoaded = false;
let fbInitialized = false;
function loadFacebookSdk() {
  if (fbSdkLoaded || typeof window === "undefined") return;
  fbSdkLoaded = true;
/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Initializes Facebook SDK with the given app ID, enabling
 * cookies and disabling xfbml. The version of the SDK is
 * set to v19.0.
 * @param {string} appId - The Facebook app ID.
 * @param {boolean} cookie - Whether to enable cookies.
 * @param {boolean} xfbml - Whether to enable xfbml.
 * @param {string} version - The version of the SDK.
 */
/*******  c81d0ba4-b3b6-40ac-ba50-0586251df85e  *******/  window.fbAsyncInit = function () {
    window.FB.init({ appId: FB_APP_ID, cookie: true, xfbml: false, version: "v19.0" });
    fbInitialized = true;
  };
  const script = document.createElement("script");
  script.src = "https://connect.facebook.net/es_LA/sdk.js";
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
}
if (FB_APP_ID) loadFacebookSdk();

// LoginModal with login + register + welcome views
function LoginModal({ onClose, onLoginSuccess, onNavigateProfile }) {
  const { login } = useContext(AuthContext);
  const [view, setView] = useState("login");
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [oauthData, setOauthData] = useState(null); // Store OAuth response for nickname flow

  const genderOptions = [
    { label: "Femenino", value: "Mujer" },
    { label: "Masculino", value: "Hombre" },
    { label: "Otro", value: "LGTBQ+" }
  ];

  const switchView = (newView) => {
    setView(newView);
    setForm({});
    setError("");
  };

  // Google OAuth
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");
      try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: tokenResponse.access_token })
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }
        // Store data and ask for nickname
        setOauthData(data);
        setForm({ nickname: data.user.nombre || "" });
        setView("askNickname");
      } catch (err) {
        setError("Error al conectar con Google");
      }
    },
    onError: () => setError("Error al iniciar sesion con Google")
  });

  // Facebook OAuth
  const handleFacebookLogin = () => {
    setError("");
    // Facebook requires HTTPS
    if (window.location.protocol !== "https:") {
      setError("Facebook requiere HTTPS. Prueba en produccion o usa Google.");
      return;
    }
    if (!window.FB || !fbInitialized) {
      setError("Facebook SDK no cargado. Intenta de nuevo en unos segundos.");
      return;
    }
    window.FB.login((response) => {
      if (response.authResponse) {
        const { accessToken } = response.authResponse;
        fetch(`${API_URL}/api/auth/facebook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken })
        })
          .then(res => res.json())
          .then(data => {
            if (data.error) {
              setError(data.error);
              return;
            }
            // Store data and ask for nickname
            setOauthData(data);
            setForm({ nickname: data.user.nombre || "" });
            setView("askNickname");
          })
          .catch(() => setError("Error al conectar con Facebook"));
      }
    }, { scope: "email,public_profile" });
  };

  const handleLogin = async () => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      login(data);
      onLoginSuccess();
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!form.genero) {
      setError("Selecciona tu genero");
      return;
    }
    if (!form.fechaNacimiento) {
      setError("Ingresa tu fecha de nacimiento");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      // Auto-login after register
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      const loginData = await loginRes.json();
      if (loginData.error) {
        setError(loginData.error);
        return;
      }
      login(loginData);
      setView("welcome");
    } catch (err) {
      setError("Error de conexión");
    }
  };

  // Save nickname after OAuth
  const handleSaveNickname = async () => {
    if (!form.nickname?.trim()) {
      setError("Ingresa como quieres que te llamemos");
      return;
    }
    setError("");
    try {
      // Update nickname in backend
      const res = await fetch(`${API_URL}/api/auth/me/nickname`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${oauthData.token}`
        },
        body: JSON.stringify({ nombre: form.nickname.trim() })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      // Login with updated user data
      login({ token: oauthData.token, user: data.user });
      onLoginSuccess();
    } catch (err) {
      setError("Error al guardar nombre");
    }
  };

  const modalStyles = {
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    },
    modal: {
      background: "#fff",
      borderRadius: "16px",
      padding: "40px",
      width: "400px",
      maxWidth: "90vw",
      position: "relative",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
    },
    closeBtn: {
      position: "absolute",
      top: "15px",
      right: "20px",
      background: "none",
      border: "none",
      fontSize: "24px",
      cursor: "pointer",
      color: "#999"
    },
    title: {
      fontSize: "28px",
      fontWeight: 900,
      marginBottom: "8px",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      textAlign: "center"
    },
    subtitle: {
      fontSize: "14px",
      color: "#666",
      marginBottom: "25px",
      textAlign: "center",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    input: {
      width: "100%",
      padding: "12px 15px",
      border: "2px solid #ddd",
      borderRadius: "8px",
      fontSize: "16px",
      marginBottom: "12px",
      boxSizing: "border-box",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      outline: "none"
    },
    button: {
      width: "100%",
      padding: "14px",
      backgroundColor: "#000",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontSize: "18px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginBottom: "12px"
    },
    socialSection: {
      textAlign: "center",
      marginTop: "15px",
      paddingTop: "15px",
      borderTop: "1px solid #eee"
    },
    socialText: {
      fontSize: "13px",
      color: "#999",
      marginBottom: "12px"
    },
    socialButtons: {
      display: "flex",
      gap: "10px",
      justifyContent: "center"
    },
    socialBtn: {
      padding: "10px 20px",
      border: "2px solid #ddd",
      borderRadius: "8px",
      background: "#fff",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "bold"
    },
    error: {
      color: "#ff4444",
      fontSize: "14px",
      marginBottom: "12px",
      textAlign: "center"
    },
    switchLink: {
      textAlign: "center",
      marginTop: "15px",
      fontSize: "14px",
      color: "#666",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    link: {
      color: "#007bff",
      cursor: "pointer",
      textDecoration: "underline",
      background: "none",
      border: "none",
      fontSize: "14px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <button style={modalStyles.closeBtn} onClick={onClose}>x</button>

        {view === "login" ? (
          <>
            <div style={modalStyles.title}>Iniciar Sesion</div>
            <div style={modalStyles.subtitle}>
              Registrate para conocer todos los eventos o crear los tuyos propios
            </div>

            {error && <div style={modalStyles.error}>{error}</div>}

            <input
              style={modalStyles.input}
              placeholder="Email"
              type="email"
              value={form.email || ""}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Contrasena"
              type="password"
              value={form.password || ""}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
            <button style={modalStyles.button} onClick={handleLogin}>
              Iniciar Sesion
            </button>

            <div style={modalStyles.socialSection}>
              <div style={modalStyles.socialText}>o inicia sesion con</div>
              <div style={modalStyles.socialButtons}>
                <button style={modalStyles.socialBtn} onClick={() => googleLogin()}>Google</button>
                <button style={modalStyles.socialBtn} onClick={handleFacebookLogin}>Facebook</button>
              </div>
            </div>

            <div style={modalStyles.switchLink}>
              No tienes cuenta?{" "}
              <button
                style={{
                  ...modalStyles.link,
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#000",
                  background: "none",
                  border: "none",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  cursor: "pointer",
                  fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
                }}
                onClick={() => switchView("register")}
              >
                Crear cuenta
              </button>
            </div>
          </>
        ) : view === "register" ? (
          <>
            <div style={modalStyles.title}>Crear Cuenta</div>
            <div style={modalStyles.subtitle}>
              Completa tus datos para unirte a la comunidad
            </div>

            {error && <div style={modalStyles.error}>{error}</div>}

            <input
              style={modalStyles.input}
              placeholder="Nombre"
              value={form.nombre || ""}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Apellido"
              value={form.apellido || ""}
              onChange={e => setForm({ ...form, apellido: e.target.value })}
            />

            {/* Selector de género */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{
                fontSize: "14px",
                color: "#666",
                marginBottom: "8px",
                fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
              }}>
                Genero
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {genderOptions.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: form.genero === g.value ? "2px solid #000" : "2px solid #ddd",
                      borderRadius: "8px",
                      background: form.genero === g.value ? "#000" : "#fff",
                      color: form.genero === g.value ? "#fff" : "#333",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
                    }}
                    onClick={() => setForm({ ...form, genero: g.value })}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha de nacimiento */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{
                fontSize: "14px",
                color: "#666",
                marginBottom: "8px",
                fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
              }}>
                Fecha de nacimiento
              </div>
              <input
                style={modalStyles.input}
                type="date"
                value={form.fechaNacimiento || ""}
                onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })}
              />
            </div>

            <input
              style={modalStyles.input}
              placeholder="Email"
              type="email"
              value={form.email || ""}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Contrasena"
              type="password"
              value={form.password || ""}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
            <button style={modalStyles.button} onClick={handleRegister}>
              Registrarse
            </button>

            <div style={modalStyles.socialSection}>
              <div style={modalStyles.socialText}>o registrate con</div>
              <div style={modalStyles.socialButtons}>
                <button style={modalStyles.socialBtn} onClick={() => googleLogin()}>Google</button>
                <button style={modalStyles.socialBtn} onClick={handleFacebookLogin}>Facebook</button>
              </div>
            </div>

            <div style={modalStyles.switchLink}>
              Ya tienes cuenta?{" "}
              <button style={modalStyles.link} onClick={() => switchView("login")}>
                Iniciar sesion
              </button>
            </div>
          </>
        ) : view === "askNickname" ? (
          /* Ask for nickname after OAuth */
          <>
            <div style={modalStyles.title}>Como quieres que te llamemos?</div>
            <div style={modalStyles.subtitle}>
              Puedes usar tu nombre o un apodo
            </div>

            {error && <div style={modalStyles.error}>{error}</div>}

            <input
              style={modalStyles.input}
              placeholder="Tu nombre o apodo"
              value={form.nickname || ""}
              onChange={e => setForm({ ...form, nickname: e.target.value })}
              autoFocus
            />
            <button style={modalStyles.button} onClick={handleSaveNickname}>
              Continuar
            </button>
          </>
        ) : (
          /* Welcome view after registration */
          <>
            <div style={modalStyles.title}>Bienvenido/a!</div>
            <div style={modalStyles.subtitle}>
              Tu cuenta fue creada con exito
            </div>
            <button
              style={{ ...modalStyles.button, marginBottom: "10px" }}
              onClick={onLoginSuccess}
            >
              Buscar eventos
            </button>
            <button
              style={{
                ...modalStyles.button,
                background: "#fff",
                color: "#000",
                border: "2px solid #000"
              }}
              onClick={onNavigateProfile}
            >
              Completa tu perfil
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Deterministic pseudo-random from event id (0-1 range)
function seedFromId(id) {
  let hash = 0;
  for (let i = 0; i < (id || "").length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

// Card component for events grid
// sizeFactor: explicit scale (e.g. 0.7 for featured). If omitted, uses seed-based random scale.
function EventPostItCard({ event, isLoggedIn, sizeFactor: externalScale }) {
  const seed = seedFromId(event._id);
  const rotation = externalScale != null ? 0 : (seed - 0.5) * 4;
  const factor = externalScale ?? (0.88 + seed * 0.24);
  const s = (px) => `${Math.round(px * factor)}px`;

  const getCardGradient = () => {
    if (event.category === "Partido") {
      return "linear-gradient(135deg, #A9FF68, #FF8989)";
    }
    if (event.category === "Evento") {
      return "linear-gradient(135deg, #145277, #83D0CB)";
    }
    if (event.category === "Social") {
      return "linear-gradient(135deg, #84FFC9, #AAB2FF, #ECA0FF)";
    }
    return "linear-gradient(135deg, #e0e0e0, #f5f5f5)";
  };

  const isEvento = event.category === "Evento";
  const cardWidth = isEvento ? 280 : 400;
  const cardHeight = isEvento ? 497 : 250;

  const currentParticipants = (event.participants?.length || 0) + (event.manualParticipants?.length || 0);
  const maxParticipants = event.maxParticipants || 10;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${date.getDate()} de ${meses[date.getMonth()]}`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const cardStyles = {
    card: {
      width: s(cardWidth),
      height: s(cardHeight),
      background: getCardGradient(),
      borderRadius: s(20),
      padding: s(25),
      position: "relative",
      border: `${Math.max(2, Math.round(3 * factor))}px solid #333`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      overflow: "hidden",
      cursor: "pointer",
      boxSizing: "border-box",
      transform: rotation ? `rotate(${rotation}deg)` : undefined
    },
    topSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: s(8)
    },
    titleContainer: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      textAlign: "left"
    },

    titleLine: {
      fontSize: s(44),
      fontWeight: 900,
      color: "#000",
      lineHeight: 1.1,
      textAlign: "left",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
    }
,
    rating: {
      fontSize: s(24),
      fontWeight: "bold",
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      whiteSpace: "nowrap",
      marginLeft: s(10)
    },
    bottomSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: s(16),
      fontSize: s(16),
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      color: "#000"
    },
    blurred: {
      filter: "blur(5px)",
      userSelect: "none",
      pointerEvents: "none"
    },
    stampOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) rotate(-15deg)",
      width: "70%",
      opacity: 0.6,
      pointerEvents: "none",
      zIndex: 2
    }
  };

  return (
    <div style={cardStyles.card}>
      {!isLoggedIn && (
        <img
          src="/assets/stamp.png"
          alt=""
          style={cardStyles.stampOverlay}
        />
      )}

      <div style={cardStyles.topSection}>
        <div style={cardStyles.titleContainer}>
          {event.category === "Partido" && (
            <>
              <div style={cardStyles.titleLine}>Partido de</div>
              <div style={{ ...cardStyles.titleLine, fontSize: s(40) }}>
                {event.title.replace("Partido de ", "")}
              </div>
            </>
          )}

          {event.category !== "Partido" && (
            <div style={cardStyles.titleLine}>{event.title}</div>
          )}

          {event.subcategory && (
            <div style={{ ...cardStyles.titleLine, fontSize: s(28), marginTop: s(4), fontWeight: 999 }}>
              {/^\d+$/.test(event.subcategory) ? `Para ${event.subcategory} personas` : event.subcategory}
            </div>
          )}
        </div>
        <div style={cardStyles.rating}>{currentParticipants}/{maxParticipants}</div>
      </div>
      <div style={{ flexGrow: 1 }} />

      <div style={{ ...cardStyles.bottomSection, ...(isLoggedIn ? {} : cardStyles.blurred) }}>
        <div>
          {event.location && <div>{event.location}</div>}
          <div>
            {event.cost > 0 ? `$${event.cost} por persona` : "Gratis"}
          </div>
        </div>

        {event.date && (
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div>{formatDate(event.date)}</div>
            <div>{formatTime(event.date)} hs</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { auth, logout, fetchWithAuth } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeIntent, setActiveIntent] = useState(null);
  const [heroPhrase, setHeroPhrase] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  const heroTexts = [
    "Hagamos algo. Descubre cientos de eventos.",
    "Y si jugamos un partido de voley? o jugamos cartas?",
    "Descubre planes hoy o arma el tuyo en menos de un minuto"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroPhrase(prev => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Intent-based exploration: maps human intentions to filter logic
  const intents = {
    "Quiero salir": {
      emoji: "🎉",
      keywords: ["fiesta", "carrete", "bar", "pub", "discoteca", "noche", "junta", "asado", "terraza", "brunch", "cafe", "café"],
      categories: ["Social"],
      description: "Fiestas, juntas, carretes"
    },
    "Quiero jugar": {
      emoji: "🎮",
      keywords: ["partido", "futbol", "voley", "tenis", "padel", "basket", "cartas", "pokemon", "magic", "uno", "juego", "gaming"],
      categories: ["Partido"],
      description: "Deportes, juegos, cartas"
    },
    "Conocer gente": {
      emoji: "👋",
      keywords: ["meetup", "networking", "social", "comunidad", "grupo", "nuevo", "conocer", "amigos"],
      categories: ["Social"],
      excludeKeywords: ["clase", "taller", "curso"],
      description: "Meetups, nuevos amigos"
    },
    "Aprender algo": {
      emoji: "📚",
      keywords: ["clase", "taller", "curso", "workshop", "charla", "conferencia", "capacitacion", "tutorial", "aprende"],
      categories: [],
      description: "Clases, talleres, cursos"
    }
  };

  const matchesIntent = (ev) => {
    if (!activeIntent) return true;
    const intent = intents[activeIntent];
    if (!intent) return true;

    const title = (ev.title || "").toLowerCase();
    const desc = (ev.description || "").toLowerCase();
    const loc = (ev.location || "").toLowerCase();
    const combined = `${title} ${desc} ${loc}`;

    // Check excluded keywords first
    if (intent.excludeKeywords?.some(k => combined.includes(k))) return false;

    // Match by keywords OR category
    const keywordMatch = intent.keywords.some(k => combined.includes(k));
    const categoryMatch = intent.categories.length > 0 && intent.categories.includes(ev.category);

    return keywordMatch || categoryMatch;
  };

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch notifications + real-time via Socket.IO
  useEffect(() => {
    if (!auth) return;
    const fetchNotifications = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/notifications`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();

    // Real-time notifications via socket
    const socket = io(API_URL);
    socket.emit("join-user", auth.user.id);
    socket.on("new-notification", (notification) => {
      setNotifications(prev => [notification, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [auth]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await fetchWithAuth(`${API_URL}/api/notifications/read-all`, { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking notifications read:", err);
    }
  };

  // Close notification panel on outside click
  useEffect(() => {
    const handleClickOutsideNotif = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideNotif);
    return () => document.removeEventListener("mousedown", handleClickOutsideNotif);
  }, []);

  const isLoggedIn = !!auth;
  const userName = auth?.user?.nombre || "Usuario";
  const menuRef = useRef(null);

  // Available events: not past, not full
  const availableEvents = events.filter((ev) => {
    if (ev.date && new Date(ev.date) < new Date()) return false;
    const total = (ev.participants?.length || 0) + (ev.manualParticipants?.length || 0);
    if (total >= ev.maxParticipants) return false;
    return true;
  });

  const filteredEvents = availableEvents.filter((ev) => {
    // Intent filter (primary exploration method)
    if (activeIntent) {
      if (!matchesIntent(ev)) return false;
    }
    return true;
  });

  // Rotate featured event card every 5 seconds (only available events)
  useEffect(() => {
    if (availableEvents.length === 0) return;
    setFeaturedIndex(0);
    const interval = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % availableEvents.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [availableEvents.length]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [auth]);

  const fetchEvents = async () => {
    try {
      let url = `${API_URL}/api/events`;
      if (auth?.user?.genero) {
        url += `?genero=${encodeURIComponent(auth.user.genero)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (eventId) => {
    if (isLoggedIn) {
      navigate(`/event/${eventId}`);
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    window.location.reload();
  };

  const styles = {
    wrapper: {
      minHeight: "100vh",
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      backgroundColor: "#e8e8e8"
    },
    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 40px",
      background: "rgba(255,255,255,0.9)",
      borderBottom: "3px solid #333"
    },
    logo: {
      fontSize: "28px",
      fontWeight: 900,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      color: "#000"
    },
    authButton: {
      background: "#000",
      color: "#fff",
      border: "none",
      padding: "10px 25px",
      borderRadius: "8px",
      fontSize: "16px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
    },
    userMenuWrapper: {
      position: "relative"
    },
    welcomeBtn: {
      background: "none",
      border: "none",
      fontSize: "18px",
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      color: "#000",
      padding: "8px 0"
    },
    dropdown: {
      position: "absolute",
      top: "100%",
      right: 0,
      marginTop: "8px",
      background: "#fff",
      border: "3px solid #333",
      borderRadius: "12px",
      boxShadow: "4px 4px 0 #000",
      minWidth: "220px",
      zIndex: 100,
      overflow: "hidden"
    },
    dropdownItem: {
      display: "block",
      width: "100%",
      padding: "14px 20px",
      background: "none",
      border: "none",
      borderBottom: "1px solid #eee",
      fontSize: "16px",
      fontWeight: 600,
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      cursor: "pointer",
      textAlign: "left",
      color: "#333"
    },
    dropdownItemLast: {
      display: "block",
      width: "100%",
      padding: "14px 20px",
      background: "none",
      border: "none",
      fontSize: "16px",
      fontWeight: 600,
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      cursor: "pointer",
      textAlign: "left",
      color: "#ff4444"
    },
    content: {
      padding: "40px"
    },
    header: {
      textAlign: "center",
      marginBottom: "20px"
    },
    title: {
      fontSize: isMobile ? "28px" : "42px",
      fontWeight: 900,
      marginBottom: "10px",
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      lineHeight: 1.2,
      maxWidth: "600px",
      margin: "0 auto 10px"
    },
    buttonContainer: {
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? "12px" : "15px",
      justifyContent: "center",
      alignItems: "center",
      marginTop: "25px"
    },
    btnPrimary: {
      padding: "14px 30px",
      background: "#000",
      color: "#fff",
      border: "3px solid #000",
      borderRadius: "0px",
      fontSize: "16px",
      cursor: "pointer",
      fontWeight: "bold",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      boxShadow: "3px 3px 0 #333",
      textTransform: "uppercase"
    },
    btnSecondary: {
      padding: "14px 30px",
      background: "#fff",
      color: "#000",
      border: "3px solid #000",
      borderRadius: "0px",
      fontSize: "16px",
      cursor: "pointer",
      fontWeight: "bold",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      boxShadow: "none",
      textTransform: "uppercase"
    },
    intentContainer: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: isMobile ? "10px" : "14px",
      maxWidth: isMobile ? "340px" : "500px",
      margin: "0 auto 30px",
      padding: "0 10px"
    },
    intentChip: {
      padding: isMobile ? "12px 16px" : "14px 24px",
      borderRadius: "12px",
      border: "3px solid #333",
      fontSize: isMobile ? "14px" : "16px",
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      cursor: "pointer",
      transition: "all 0.15s ease",
      background: "#fff",
      color: "#000",
      boxShadow: "3px 3px 0 #000",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    intentChipActive: {
      padding: isMobile ? "12px 16px" : "14px 24px",
      borderRadius: "12px",
      border: "3px solid #000",
      fontSize: isMobile ? "14px" : "16px",
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      cursor: "pointer",
      transition: "all 0.15s ease",
      background: "#000",
      color: "#fff",
      boxShadow: "none",
      transform: "translate(3px, 3px)",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    eventsSection: {
      marginTop: "40px"
    },
    sectionTitle: {
      fontSize: "32px",
      fontWeight: 900,
      marginBottom: "30px",
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      textTransform: "uppercase"
    },
    eventsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, auto))",
      gap: "30px",
      justifyContent: "center",
      justifyItems: "center",
      alignItems: "start"
    },
    emptyState: {
      textAlign: "center",
      padding: "60px 20px",
      color: "#666"
    },
    loadingMessage: {
      textAlign: "center",
      fontSize: "24px",
      fontWeight: 900,
      color: "#000",
      padding: "100px 40px",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
    }
  };

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.loadingMessage}>Cargando eventos...</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
          onNavigateProfile={() => {
            setShowLoginModal(false);
            navigate("/profile");
          }}
        />
      )}

      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>Kiu</div>
        {isLoggedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Notification Bell */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "22px", position: "relative", padding: "4px" }}
              >
                &#128276;
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: "-2px", right: "-4px",
                    background: "#ff4444", color: "#fff", borderRadius: "50%",
                    width: "18px", height: "18px", fontSize: "11px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: "bold", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
                  }}>{unreadCount}</span>
                )}
              </button>
              {showNotifications && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: "8px",
                  background: "#fff", border: "3px solid #000", borderRadius: "12px",
                  boxShadow: "4px 4px 0 #000", width: isMobile ? "280px" : "340px",
                  maxHeight: "400px", overflowY: "auto", zIndex: 1000
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", borderBottom: "2px solid #eee"
                  }}>
                    <span style={{ fontWeight: 900, fontSize: "16px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>Notificaciones</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}
                      >Marcar todas leidas</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                      No hay notificaciones
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => { setShowNotifications(false); if (n.event?._id) navigate(`/event/${n.event._id}`); }}
                        style={{
                          padding: "12px 16px", cursor: "pointer",
                          borderBottom: "1px solid #eee",
                          background: n.read ? "#fff" : "#f0f7ff",
                          transition: "background 0.2s"
                        }}
                      >
                        <div style={{ fontSize: "14px", fontWeight: n.read ? "normal" : "bold", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: "11px", color: "#999", marginTop: "4px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                          {new Date(n.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div ref={menuRef} style={styles.userMenuWrapper}>
              <button
                style={styles.welcomeBtn}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {auth?.user?.genero === "Mujer" ? "Bienvenida" : "Bienvenido"}, {userName} ▾
              </button>
            {showUserMenu && (
              <div style={styles.dropdown}>
                <button
                  style={styles.dropdownItem}
                  onClick={() => { setShowUserMenu(false); navigate("/profile"); }}
                >
                  Mi perfil
                </button>
                <button
                  style={styles.dropdownItem}
                  onClick={() => { setShowUserMenu(false); navigate("/my-events"); }}
                >
                  Mis eventos
                </button>
                <button
                  style={styles.dropdownItem}
                  onClick={() => { setShowUserMenu(false); navigate("/conversations"); }}
                >
                  Mis conversaciones
                </button>
                <button
                  style={styles.dropdownItemLast}
                  onClick={() => { setShowUserMenu(false); logout(); }}
                >
                  Cerrar sesion
                </button>
              </div>
            )}
          </div>
          </div>
        ) : (
          <button style={styles.authButton} onClick={() => setShowLoginModal(true)}>
            Iniciar Sesion
          </button>
        )}
      </div>

      {/* Keyframe for progress bar */}
      <style>{`
        @keyframes shrinkBar {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title} key={`hero-${heroPhrase}`}>{heroTexts[heroPhrase]}</h1>

          {/* Featured event card carousel */}
          {availableEvents.length > 0 && (() => {
            const feat = availableEvents[featuredIndex % availableEvents.length];
            if (!feat) return null;
            return (
              <div style={{ display: "flex", justifyContent: "center", margin: "24px auto 0" }}>
                <div
                  key={`feat-${featuredIndex}`}
                  style={{
                    position: "relative",
                    animation: "fadeInCard 0.3s ease"
                  }}
                  onClick={() => handleCardClick(feat._id)}
                >
                  <EventPostItCard event={feat} isLoggedIn={isLoggedIn} sizeFactor={0.7} />
                  {/* Progress bar countdown */}
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    background: "rgba(0,0,0,0.1)",
                    borderRadius: "0 0 14px 14px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      height: "100%",
                      background: "#000",
                      animation: "shrinkBar 5s linear forwards"
                    }} />
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={styles.buttonContainer}>
            {isLoggedIn ? (
              <>
                <button
                  style={styles.btnPrimary}
                  onClick={() => document.getElementById("events-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explorar Eventos
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => navigate("/create-event")}
                >
                  Crear Evento
                </button>
              </>
            ) : (
              <>
                <button
                  style={styles.btnPrimary}
                  onClick={() => document.getElementById("events-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explorar Eventos
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setShowLoginModal(true)}
                >
                  Iniciar Sesion
                </button>
              </>
            )}
          </div>
        </div>

        {/* Events Grid */}
        <div style={styles.eventsSection} id="events-section">
          {/* Intent-based exploration */}
          <div style={styles.intentContainer}>
            {Object.entries(intents).map(([intentName, intent]) => (
              <button
                key={intentName}
                style={activeIntent === intentName ? styles.intentChipActive : styles.intentChip}
                onClick={() => setActiveIntent(activeIntent === intentName ? null : intentName)}
              >
                <span>{intent.emoji}</span>
                <span>{intentName}</span>
              </button>
            ))}
          </div>

          {filteredEvents.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: "18px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                {activeIntent
                  ? `No hay eventos para "${activeIntent}" aun. Proba con otra opcion.`
                  : "No hay eventos aun. Se el primero en crear uno."}
              </p>
            </div>
          ) : (
            <div style={styles.eventsGrid}>
              {filteredEvents.map(event => (
                <div
                  key={event._id}
                  onClick={() => handleCardClick(event._id)}
                >
                  <EventPostItCard event={event} isLoggedIn={isLoggedIn} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
