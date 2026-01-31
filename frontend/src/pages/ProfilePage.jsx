import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProfilePage() {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const user = auth?.user || {};

  const styles = {
    wrapper: {
      minHeight: "100vh",
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      backgroundColor: "#e8e8e8",
      padding: "40px"
    },
    backBtn: {
      background: "none",
      border: "3px solid #333",
      borderRadius: "0",
      padding: "10px 20px",
      fontSize: "16px",
      fontWeight: "bold",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      cursor: "pointer",
      boxShadow: "3px 3px 0 #000",
      marginBottom: "30px",
      color: "#000",
      backgroundColor: "#fff"
    },
    title: {
      fontSize: "42px",
      fontWeight: 900,
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginBottom: "10px"
    },
    subtitle: {
      fontSize: "22px",
      color: "#2b2828",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      fontWeight: "bold",
      marginBottom: "40px"
    },
    bento: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "20px"
    },
    bentoDesktop: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(2, 1fr)",
      gap: "20px",
      minHeight: "500px"
    },
    card: {
      background: "#fff",
      border: "3px solid #333",
      borderRadius: "16px",
      padding: "30px",
      boxShadow: "4px 4px 0 #000",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    },
    cardTitle: {
      fontSize: "26px",
      fontWeight: 900,
      color: "#000",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginBottom: "12px"
    },
    cardText: {
      fontSize: "16px",
      color: "#555",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      fontWeight: "bold",
      lineHeight: 1.5
    },
    cardTag: {
      display: "inline-block",
      background: "#000",
      color: "#fff",
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginTop: "auto",
      alignSelf: "flex-start"
    }
  };

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <div style={styles.wrapper}>
      <button style={styles.backBtn} onClick={() => navigate("/")}>
        ← Volver
      </button>

      <div style={styles.title}>Hola, {user.nombre || "Usuario"}</div>
      <div style={styles.subtitle}>Tienes x eventos en los siguientes 5 diass 🎉</div>

      <div style={isDesktop ? styles.bentoDesktop : styles.bento}>
        {/* Datos personales */}
        <div style={{
          ...styles.card,
          background: "linear-gradient(135deg, #FFE4B5, #FFB347)",
          ...(isDesktop ? { gridRow: "span 2" } : {})
        }}>
          <div>
            <div style={styles.cardTitle}>Datos personales</div>
            <div style={styles.cardText}>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "#333", fontWeight: 900 }}>Genero:</span>{" "}
                {user.genero || "No especificado"}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "#333", fontWeight: 900 }}>Fecha de nacimiento:</span>{" "}
                {user.fechaNacimiento
                  ? new Date(user.fechaNacimiento).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
                  : "No especificada"}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "#333", fontWeight: 900 }}>Email:</span>{" "}
                {user.email || "—"}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ color: "#333", fontWeight: 900 }}>Telefono:</span>{" "}
                {user.telefono || "No verificado"}
              </div>
            </div>
          </div>
          <div style={{ ...styles.cardTag, background: "#FF8C00", marginTop: "20px" }}>Perfil</div>
        </div>

        {/* Eventos */}
        <div style={{
          ...styles.card,
          background: "linear-gradient(135deg, #84FFC9, #AAB2FF)"
        }}>
          <div>
            <div style={styles.cardTitle}>Eventos</div>
            <div style={styles.cardText}>
              <h2>Creados</h2>
              Tu comunidad principal. Aqui puedes ver los eventos cerca de ti y conectar con tus vecinos.
              <h2>Inscrito</h2>
            </div>
          </div>
          <div style={{ ...styles.cardTag, marginTop: "20px" }}>Comunidad</div>
        </div>

        {/* Top center */}
        <div style={{
          ...styles.card,
          background: "linear-gradient(135deg, #A9FF68, #FF8989)"
        }}>
          <div>
            <div style={styles.cardTitle}>Eventillos</div>
            <div style={styles.cardText}>
              Tus proximos eventos y los que has creado.
            </div>
          </div>
          <div style={{ ...styles.cardTag, marginTop: "20px" }}>Eventos</div>
        </div>

        {/* Bottom center */}
        <div style={{
          ...styles.card,
          background: "linear-gradient(135deg, #ECA0FF, #AAB2FF)"
        }}>
          <div>
            <div style={styles.cardTitle}>Mis conversaciones</div>
            <div style={styles.cardText}>
              Chats con organizadores y participantes de eventos.
            </div>
          </div>
          <div style={{ ...styles.cardTag, marginTop: "20px" }}>Mensajes</div>
        </div>

        {/* Right column - spans 2 rows */}
        <div style={{
          ...styles.card,
          background: "linear-gradient(135deg, #145277, #83D0CB)",
          color: "#fff",
          ...(isDesktop ? { gridRow: "span 2" } : {})
        }}>
          <div>
            <div style={{ ...styles.cardTitle, color: "#fff" }}>En que vamos</div>
            <div style={{ ...styles.cardText, color: "rgba(255,255,255,0.85)" }}>
              Tu resumen de actividad, asistencia y reputacion dentro de la comunidad.
            </div>
          </div>
          <div style={{ ...styles.cardTag, background: "#fff", color: "#145277", marginTop: "20px" }}>Stats</div>
        </div>
      </div>
    </div>
  );
}
