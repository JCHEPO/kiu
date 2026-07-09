import React, { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const GENDER_OPTIONS = [
  { label: "Femenino", value: "Mujer" },
  { label: "Masculino", value: "Hombre" },
  { label: "Otro", value: "LGTBQ+" }
];

export default function ProfilePage() {
  const { auth, login, fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [user, setUser] = useState(auth?.user || {});
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verificMsg, setVerificMsg] = useState("");

  useEffect(() => {
    if (!auth?.token) return;
    fetchWithAuth(`${API_URL}/api/auth/me`)
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          login({ token: auth.token, user: data.user });
        }
      })
      .catch(() => {});
  }, []);

  const startEditing = () => {
    const bdate = user.fechaNacimiento
      ? new Date(user.fechaNacimiento).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/")
      : "";
    setEditForm({
      nombre: user.nombre || "",
      apellido: user.apellido || "",
      genero: user.genero || "",
      fechaNacimiento: bdate,
      telefono: user.telefono || ""
    });
    setSaveError("");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaveError("");
    setSaving(true);
    try {
      let isoDate;
      if (editForm.fechaNacimiento) {
        const [day, month, year] = editForm.fechaNacimiento.split("/");
        if (!day || !month || !year || isNaN(new Date(`${year}-${month}-${day}`))) {
          setSaveError("Fecha inválida. Usa DD/MM/AAAA");
          setSaving(false);
          return;
        }
        isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      const res = await fetchWithAuth(`${API_URL}/api/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editForm.nombre,
          apellido: editForm.apellido,
          genero: editForm.genero,
          fechaNacimiento: isoDate,
          telefono: editForm.telefono
        })
      });
      const data = await res.json();
      if (data.error) {
        setSaveError(data.error);
        return;
      }
      setUser(data.user);
      login({ token: auth.token, user: data.user });
      setEditing(false);
    } catch {
      setSaveError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

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
    },
    input: {
      width: "100%",
      padding: "8px 10px",
      border: "2px solid #333",
      borderRadius: "6px",
      fontSize: "14px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      fontWeight: "bold",
      marginTop: "4px",
      boxSizing: "border-box",
      background: "#fff"
    },
    label: {
      display: "block",
      fontSize: "13px",
      fontWeight: 900,
      color: "#333",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      marginBottom: "2px"
    },
    fieldGroup: {
      marginBottom: "10px"
    },
    actionBtn: {
      padding: "8px 16px",
      border: "2px solid #333",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      cursor: "pointer",
      boxShadow: "2px 2px 0 #000"
    }
  };

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <div style={styles.wrapper}>
      <button style={styles.backBtn} onClick={() => navigate("/")}>
        ← Volver
      </button>

      <div style={styles.title}>Hola, {user.nombre || "Usuario"}</div>
      <div style={styles.subtitle}>Este es tu espacio en Kiu 🎉</div>

      <div style={isDesktop ? styles.bentoDesktop : styles.bento}>
        {/* Datos personales */}
        <div style={{
          ...styles.card,
          background: "linear-gradient(135deg, #FFE4B5, #FFB347)",
          ...(isDesktop ? { gridRow: "span 2" } : {})
        }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={styles.cardTitle}>Datos personales</div>
              {!editing && (
                <button
                  style={{ ...styles.actionBtn, background: "#fff", color: "#000" }}
                  onClick={startEditing}
                >
                  ✏️ Editar
                </button>
              )}
            </div>

            {editing ? (
              <div>
                {saveError && (
                  <div style={{ color: "#ff4444", fontSize: "13px", marginBottom: "10px", fontFamily: '"Patrick Hand", cursive' }}>
                    {saveError}
                  </div>
                )}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Nombre</label>
                  <input style={styles.input} value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Apellido</label>
                  <input style={styles.input} value={editForm.apellido} onChange={e => setEditForm({ ...editForm, apellido: e.target.value })} />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Genero</label>
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    {GENDER_OPTIONS.map(g => (
                      <button
                        key={g.value}
                        type="button"
                        style={{
                          flex: 1,
                          padding: "6px 4px",
                          border: editForm.genero === g.value ? "2px solid #000" : "2px solid #ccc",
                          borderRadius: "6px",
                          background: editForm.genero === g.value ? "#000" : "#fff",
                          color: editForm.genero === g.value ? "#fff" : "#333",
                          fontSize: "12px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontFamily: '"Patrick Hand", cursive'
                        }}
                        onClick={() => setEditForm({ ...editForm, genero: g.value })}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Fecha de nacimiento (DD/MM/AAAA)</label>
                  <input
                    style={styles.input}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    value={editForm.fechaNacimiento}
                    onChange={e => {
                      let val = e.target.value.replace(/[^\d/]/g, "");
                      if (val.length === 2 && editForm.fechaNacimiento?.length === 1) val += "/";
                      if (val.length === 5 && editForm.fechaNacimiento?.length === 4) val += "/";
                      setEditForm({ ...editForm, fechaNacimiento: val });
                    }}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Telefono</label>
                  <input style={styles.input} placeholder="+56 9..." value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button
                    style={{ ...styles.actionBtn, background: "#000", color: "#fff", flex: 1 }}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    style={{ ...styles.actionBtn, background: "#fff", color: "#000" }}
                    onClick={() => setEditing(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.cardText}>
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ color: "#333", fontWeight: 900 }}>Nombre:</span>{" "}
                  {user.nombre ? `${user.nombre}${user.apellido ? " " + user.apellido : ""}` : "No especificado"}
                </div>
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
                  {user.telefono || "No especificado"}
                </div>
                {user.verificado ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "8px 14px", background: "#e3f2fd", color: "#1565c0", borderRadius: "8px", fontSize: "13px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginTop: "4px" }}>
                    ✓ Usuario verificado
                  </span>
                ) : user.solicitaVerificacion ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "8px 14px", background: "#fff8e1", color: "#f57f17", borderRadius: "8px", fontSize: "13px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginTop: "4px" }}>
                    ⏳ Verificación pendiente
                  </span>
                ) : (
                  <button
                    style={{ ...styles.actionBtn, background: "#fff", color: "#000", marginTop: "4px" }}
                    onClick={async () => {
                      const res = await fetchWithAuth(`${API_URL}/api/auth/me/verificacion`, { method: "POST" });
                      if (res.ok) {
                        setVerificMsg("Solicitud enviada. Un admin la revisará pronto.");
                        setUser(prev => ({ ...prev, solicitaVerificacion: true }));
                      }
                    }}
                  >
                    ✓ Solicitar verificación
                  </button>
                )}
                {verificMsg && <div style={{ marginTop: "8px", fontSize: "12px", color: "#555", fontFamily: '"Patrick Hand", system-ui, cursive' }}>{verificMsg}</div>}
              </div>
            )}
          </div>
          {!editing && (
            <div style={{ ...styles.cardTag, background: "#FF8C00", marginTop: "20px" }}>Perfil</div>
          )}
        </div>

        {/* Mis eventos */}
        <div
          style={{
            ...styles.card,
            background: "linear-gradient(135deg, #84FFC9, #AAB2FF)",
            cursor: "pointer"
          }}
          onClick={() => navigate("/my-events")}
        >
          <div>
            <div style={styles.cardTitle}>Mis eventos</div>
            <div style={styles.cardText}>
              Los eventos que creaste y a los que te uniste, todo en un lugar.
            </div>
          </div>
          <div style={{ ...styles.cardTag, marginTop: "20px" }}>Ver eventos →</div>
        </div>

        {/* Crear evento */}
        <div
          style={{
            ...styles.card,
            background: "linear-gradient(135deg, #A9FF68, #FF8989)",
            cursor: "pointer"
          }}
          onClick={() => navigate("/create-event")}
        >
          <div>
            <div style={styles.cardTitle}>Crear evento</div>
            <div style={styles.cardText}>
              Arma un partido, una juntada o lo que quieras en menos de un minuto.
            </div>
          </div>
          <div style={{ ...styles.cardTag, marginTop: "20px" }}>Crear →</div>
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
