import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function MyEventsPage() {
  const { auth, fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/events/mine`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setEvents(data);
        }
      } catch (err) {
        console.error("Error cargando mis eventos:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const now = new Date();
  const upcoming = events.filter(ev => ev.date && new Date(ev.date) >= now);
  const past = events.filter(ev => !ev.date || new Date(ev.date) < now).reverse(); // más recientes primero

  const isCreator = (ev) => {
    const creatorId = ev.creator?._id || ev.creator;
    return creatorId?.toString() === auth?.user?.id?.toString();
  };

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return `${date.getDate()} de ${MESES[date.getMonth()]} · ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} hs`;
  };

  const styles = {
    wrapper: {
      minHeight: "100vh",
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      backgroundColor: "#e8e8e8",
      padding: isMobile ? "16px" : "40px"
    },
    container: {
      maxWidth: "800px",
      margin: "0 auto"
    },
    backBtn: {
      background: "#fff",
      border: "3px solid #000",
      padding: isMobile ? "8px 14px" : "10px 20px",
      fontSize: isMobile ? "14px" : "16px",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "3px 3px 0 #000",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      marginBottom: isMobile ? "16px" : "30px",
      textTransform: "uppercase"
    },
    title: {
      fontSize: isMobile ? "32px" : "42px",
      fontWeight: 900,
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginBottom: "24px"
    },
    sectionTitle: {
      fontSize: isMobile ? "18px" : "22px",
      fontWeight: 900,
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      textTransform: "uppercase",
      margin: "24px 0 12px"
    },
    row: {
      display: "flex",
      alignItems: "center",
      gap: isMobile ? "8px" : "14px",
      padding: isMobile ? "12px 14px" : "16px 20px",
      background: "rgba(255,255,255,0.9)",
      border: "3px solid #333",
      borderRadius: "12px",
      marginBottom: "10px",
      cursor: "pointer",
      flexWrap: "wrap"
    },
    rowInfo: {
      flex: 1,
      minWidth: 0
    },
    rowTitle: {
      fontSize: isMobile ? "16px" : "18px",
      fontWeight: 800,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      color: "#000"
    },
    rowSub: {
      fontSize: isMobile ? "12px" : "14px",
      color: "#666",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      fontWeight: "bold",
      marginTop: "2px"
    },
    tag: (dark) => ({
      background: dark ? "#000" : "#666",
      color: "#fff",
      padding: "3px 12px",
      borderRadius: "20px",
      fontSize: isMobile ? "10px" : "11px",
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      textTransform: "uppercase",
      whiteSpace: "nowrap"
    }),
    count: {
      fontSize: isMobile ? "14px" : "16px",
      fontWeight: 900,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      color: "#000",
      whiteSpace: "nowrap"
    },
    empty: {
      textAlign: "center",
      padding: "30px 20px",
      color: "#666",
      fontSize: "16px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      fontWeight: "bold"
    },
    createBtn: {
      padding: "14px 30px",
      background: "#000",
      color: "#fff",
      border: "3px solid #000",
      fontSize: "16px",
      cursor: "pointer",
      fontWeight: "bold",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      boxShadow: "3px 3px 0 #333",
      textTransform: "uppercase",
      marginTop: "8px"
    },
    loading: {
      textAlign: "center",
      fontSize: "24px",
      fontWeight: 900,
      color: "#000",
      padding: "100px 40px",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
    }
  };

  const renderRow = (ev, faded = false) => {
    const total = (ev.participants?.length || 0) + (ev.manualParticipants?.length || 0);
    return (
      <div
        key={ev._id}
        style={{ ...styles.row, opacity: faded ? 0.6 : 1 }}
        onClick={() => navigate(`/event/${ev._id}`)}
      >
        <div style={styles.rowInfo}>
          <div style={styles.rowTitle}>{ev.title}</div>
          <div style={styles.rowSub}>
            {formatDate(ev.date)}{ev.location ? ` · ${ev.location}` : ""}
          </div>
        </div>
        <span style={styles.tag(isCreator(ev))}>{isCreator(ev) ? "Creador" : "Participante"}</span>
        <span style={styles.count}>{total}/{ev.maxParticipants}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.loading}>Cargando tus eventos...</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => navigate("/")}>
          ← Volver
        </button>

        <div style={styles.title}>Mis eventos</div>

        <div style={styles.sectionTitle}>Próximos ({upcoming.length})</div>
        {upcoming.length === 0 ? (
          <div style={styles.empty}>
            No tienes eventos próximos.
            <br />
            <button style={styles.createBtn} onClick={() => navigate("/create-event")}>
              Crear un evento
            </button>
          </div>
        ) : (
          upcoming.map(ev => renderRow(ev))
        )}

        <div style={styles.sectionTitle}>Pasados ({past.length})</div>
        {past.length === 0 ? (
          <div style={styles.empty}>Aún no tienes eventos pasados.</div>
        ) : (
          past.map(ev => renderRow(ev, true))
        )}
      </div>
    </div>
  );
}
