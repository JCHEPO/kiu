import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// LoginModal with login + register views
function LoginModal({ onClose, onLoginSuccess }) {
  const { login } = useContext(AuthContext);
  const [view, setView] = useState("login");
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  const switchView = (newView) => {
    setView(newView);
    setForm({});
    setError("");
  };

  const handleLogin = async () => {
    setError("");
    try {
      const res = await fetch("http://localhost:3000/api/auth/login", {
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
    try {
      const res = await fetch("http://localhost:3000/api/auth/register", {
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
      const loginRes = await fetch("http://localhost:3000/api/auth/login", {
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
      onLoginSuccess();
    } catch (err) {
      setError("Error de conexión");
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
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Contrasena"
              type="password"
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
            <button style={modalStyles.button} onClick={handleLogin}>
              Iniciar Sesion
            </button>

            <div style={modalStyles.socialSection}>
              <div style={modalStyles.socialText}>o inicia sesion con</div>
              <div style={modalStyles.socialButtons}>
                <button style={modalStyles.socialBtn}>Google</button>
                <button style={modalStyles.socialBtn}>Facebook</button>
              </div>
            </div>

            <div style={modalStyles.switchLink}>
              No tienes cuenta?{" "}
              <button style={modalStyles.link} onClick={() => switchView("register")}>
                Crear cuenta
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={modalStyles.title}>Crear Cuenta</div>
            <div style={modalStyles.subtitle}>
              Completa tus datos para unirte a la comunidad
            </div>

            {error && <div style={modalStyles.error}>{error}</div>}

            <input
              style={modalStyles.input}
              placeholder="Nombre"
              onChange={e => setForm({ ...form, nombre: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Apellido"
              onChange={e => setForm({ ...form, apellido: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Email"
              type="email"
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              style={modalStyles.input}
              placeholder="Contrasena"
              type="password"
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
            <button style={modalStyles.button} onClick={handleRegister}>
              Registrarse
            </button>

            <div style={modalStyles.switchLink}>
              Ya tienes cuenta?{" "}
              <button style={modalStyles.link} onClick={() => switchView("login")}>
                Iniciar sesion
              </button>
            </div>
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
function EventPostItCard({ event, isLoggedIn }) {
  // Scale between 0.88 
  const seed = seedFromId(event._id);
  const scale = 0.88 + seed * 0.24;
  const rotation = (seed - 0.5) * 4; // -2° a +2°


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

  const currentParticipants = event.participants?.length || 0;
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
      width: `${cardWidth}px`,
      height: `${cardHeight}px`,
      background: getCardGradient(),
      borderRadius: "20px",
      padding: "25px",
      position: "relative",
      border: "3px solid #333",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      overflow: "hidden",
      cursor: "pointer",
      transition: "transform 0.2s",
      boxSizing: "border-box",
      transform: `scale(${scale}) rotate(${rotation}deg)`
    },
    topSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    },
    titleContainer: {
      flex: 1
    },
    titleLine: {
      fontSize: "44px",
      fontWeight: 900,
      color: "#000",
      lineHeight: 1.1,
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    rating: {
      fontSize: "24px",
      fontWeight: "bold",
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      whiteSpace: "nowrap",
      marginLeft: "10px"
    },
    bottomSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "16px",
      fontSize: "16px",
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
      {/* Stamp overlay for visitor mode */}
      {!isLoggedIn && (
        <img
          src="/assets/stamp.png"
          alt=""
          style={cardStyles.stampOverlay}
        />
      )}

      {/* Top: Title + Participant Count */}
      <div style={cardStyles.topSection}>
        <div style={cardStyles.titleContainer}>
          {event.category === "Partido" && (
            <>
              <div style={cardStyles.titleLine}>Partido de</div>
              <div style={{ ...cardStyles.titleLine, fontSize: "40px" }}>
                {event.title.replace("Partido de ", "")}
              </div>
            </>
          )}

          {event.category !== "Partido" && (
            <div style={cardStyles.titleLine}>{event.title}</div>
          )}


          {event.subcategory && (
            <div style={{ ...cardStyles.titleLine, fontSize: "28px", marginTop: "4px", fontWeight: 999 }}>
              {/^\d+$/.test(event.subcategory) ? `Para ${event.subcategory} personas` : event.subcategory}
            </div>
          )}
        </div>
        <div style={cardStyles.rating}>{currentParticipants}/{maxParticipants}</div>
      </div>
      <div style={{ flexGrow: 1 }} />

      {/* Bottom: Date, Time, Location, Cost - blurred for visitors */}
      <div style={{ ...cardStyles.bottomSection, ...(isLoggedIn ? {} : cardStyles.blurred) }}>
        {/* Left info */}
        <div>
          {event.location && <div>• {event.location}</div>}
          <div>
            • {event.cost > 0 ? `$${event.cost} por persona` : "Gratis"}
          </div>
        </div>

        {/* Right info */}
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
  const { auth, logout } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeChip, setActiveChip] = useState(null);
  const [activeSubChip, setActiveSubChip] = useState(null);
  const navigate = useNavigate();

  const isLoggedIn = !!auth;
  const userName = auth?.user?.nombre || "Usuario";
  const menuRef = useRef(null);

  const chipCategories = {
    Partidos: {
      filter: (ev) => ev.category === "Partido",
      subs: ["Futbol", "Voleyball", "Handball", "Tenis", "Padel", "Basket"],
      subFilter: (ev, sub) => ev.title?.toLowerCase().includes(sub.toLowerCase())
    },
    Cartas: {
      filter: (ev) => ev.category === "Social" && ["uno", "pokemon", "magic", "one piece", "cartas", "tcg"].some(k => ev.title?.toLowerCase().includes(k)),
      subs: ["Uno", "Cartas Pokemon", "Cartas Magic", "Cartas One Piece"],
      subFilter: (ev, sub) => ev.title?.toLowerCase().includes(sub.toLowerCase().replace("cartas ", ""))
    },
    "Mundo Cafe": {
      filter: (ev) => ["cafe", "café", "degustacion", "degustación"].some(k => ev.title?.toLowerCase().includes(k) || ev.location?.toLowerCase().includes(k) || ev.description?.toLowerCase().includes(k)),
      subs: ["Degustaciones", "En Cafeterias"],
      subFilter: (ev, sub) => {
        if (sub === "Degustaciones") return ["degustacion", "degustación", "cata"].some(k => ev.title?.toLowerCase().includes(k) || ev.description?.toLowerCase().includes(k));
        if (sub === "En Cafeterias") return ["cafe", "café", "cafeteria", "cafetería"].some(k => ev.location?.toLowerCase().includes(k));
        return true;
      }
    },
    Clases: {
      filter: (ev) => ["clase", "taller", "curso", "workshop"].some(k => ev.title?.toLowerCase().includes(k) || ev.description?.toLowerCase().includes(k)),
      subs: ["Gratis", "Pagadas"],
      subFilter: (ev, sub) => {
        if (sub === "Gratis") return !ev.cost || ev.cost === 0;
        if (sub === "Pagadas") return ev.cost > 0;
        return true;
      }
    }
  };

  const handleChipClick = (chip) => {
    if (activeChip === chip) {
      setActiveChip(null);
      setActiveSubChip(null);
    } else {
      setActiveChip(chip);
      setActiveSubChip(null);
    }
  };

  const handleSubChipClick = (sub) => {
    setActiveSubChip(activeSubChip === sub ? null : sub);
  };

  const filteredEvents = events.filter((ev) => {
    if (!activeChip) return true;
    const cat = chipCategories[activeChip];
    if (!cat) return true;
    if (!cat.filter(ev)) return false;
    if (activeSubChip && cat.subFilter) return cat.subFilter(ev, activeSubChip);
    return true;
  });

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
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/events");
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
      marginBottom: "50px"
    },
    title: {
      fontSize: "48px",
      fontWeight: 900,
      marginBottom: "10px",
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    subtitle: {
      fontSize: "18px",
      color: "#444",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    buttonContainer: {
      display: "flex",
      gap: "15px",
      justifyContent: "center",
      marginTop: "25px"
    },
    btnAction: {
      padding: "14px 30px",
      background: "#fff",
      color: "#000",
      border: "3px solid #000",
      borderRadius: "0px",
      fontSize: "16px",
      cursor: "pointer",
      fontWeight: "bold",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      boxShadow: "3px 3px 0 #000",
      textTransform: "uppercase"
    },
    chipsContainer: {
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      justifyContent: "center",
      marginBottom: "20px"
    },
    chip: {
      padding: "10px 24px",
      borderRadius: "50px",
      border: "3px solid #333",
      fontSize: "16px",
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      cursor: "pointer",
      transition: "all 0.2s",
      background: "#fff",
      color: "#000",
      boxShadow: "2px 2px 0 #000"
    },
    chipActive: {
      padding: "10px 24px",
      borderRadius: "50px",
      border: "3px solid #333",
      fontSize: "16px",
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      cursor: "pointer",
      transition: "all 0.2s",
      background: "#000",
      color: "#fff",
      boxShadow: "2px 2px 0 #333"
    },
    subChipsContainer: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      justifyContent: "center",
      marginBottom: "25px"
    },
    subChip: {
      padding: "6px 16px",
      borderRadius: "50px",
      border: "2px solid #999",
      fontSize: "13px",
      fontWeight: 600,
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      cursor: "pointer",
      transition: "all 0.2s",
      background: "rgba(255,255,255,0.7)",
      color: "#555"
    },
    subChipActive: {
      padding: "6px 16px",
      borderRadius: "50px",
      border: "2px solid #333",
      fontSize: "13px",
      fontWeight: 600,
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      cursor: "pointer",
      transition: "all 0.2s",
      background: "#333",
      color: "#fff"
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
        />
      )}

      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>Kiu</div>
        {isLoggedIn ? (
          <div ref={menuRef} style={styles.userMenuWrapper}>
            <button
              style={styles.welcomeBtn}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              Bienvenido, {userName} ▾
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
        ) : (
          <button style={styles.authButton} onClick={() => setShowLoginModal(true)}>
            Iniciar Sesion
          </button>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Kiu</h1>
          <p style={styles.subtitle}>Crea y descubre eventos en tu comunidad</p>

          <div style={styles.buttonContainer}>
            {isLoggedIn ? (
              <>
                <button
                  style={styles.btnAction}
                  onClick={() => navigate("/create-event")}
                >
                  Crear Evento
                </button>
                <button
                  style={styles.btnAction}
                  onClick={() => document.getElementById("events-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explorar
                </button>
              </>
            ) : (
              <button
                style={styles.btnAction}
                onClick={() => setShowLoginModal(true)}
              >
                Iniciar Sesion
              </button>
            )}
          </div>
        </div>

        {/* Events Grid */}
        <div style={styles.eventsSection} id="events-section">
          <h2 style={styles.sectionTitle}>Eventos Disponibles</h2>

          {/* Filter Chips */}
          <div style={styles.chipsContainer}>
            {Object.keys(chipCategories).map((chip) => (
              <button
                key={chip}
                style={activeChip === chip ? styles.chipActive : styles.chip}
                onClick={() => handleChipClick(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Sub-chips */}
          {activeChip && chipCategories[activeChip] && (
            <div style={styles.subChipsContainer}>
              {chipCategories[activeChip].subs.map((sub) => (
                <button
                  key={sub}
                  style={activeSubChip === sub ? styles.subChipActive : styles.subChip}
                  onClick={() => handleSubChipClick(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {filteredEvents.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: "18px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                {activeChip ? "No hay eventos para este filtro." : "No hay eventos aun. Se el primero en crear uno."}
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
