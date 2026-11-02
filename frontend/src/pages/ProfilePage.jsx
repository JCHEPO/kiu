import React, { useContext, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const GENDER_OPTIONS = [
  { label: "Femenino", value: "Mujer" },
  { label: "Masculino", value: "Hombre" },
  { label: "Otro o prefiero no decir", value: "Otro" }
];

// "LGTBQ+" es el valor antiguo de "Otro"
const etiquetaGenero = (g) => (g === "Otro" || g === "LGTBQ+" ? "Otro o prefiero no decir" : g);

export default function ProfilePage() {
  const { auth, login, logout, fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [user, setUser] = useState(auth?.user || {});
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verificMsg, setVerificMsg] = useState("");

  // Tus datos: descargar y borrar cuenta
  const [datosMsg, setDatosMsg] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const descargarDatos = async () => {
    setDatosMsg("");
    try {
      const res = await fetchWithAuth(`${API_URL}/api/auth/me/datos`);
      if (!res.ok) throw new Error();
      const blob = new Blob([JSON.stringify(await res.json(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kiu-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDatosMsg("Listo: se descargó un archivo con tus datos.");
    } catch {
      setDatosMsg("No se pudieron descargar tus datos. Intenta de nuevo.");
    }
  };

  const borrarCuenta = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      const body = user.tienePassword ? { password: deleteInput } : { confirmacion: deleteInput };
      const res = await fetchWithAuth(`${API_URL}/api/auth/me`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "No se pudo borrar la cuenta");
        setDeleting(false);
        return;
      }
      logout(); // cierra la sesión y vuelve al inicio
    } catch {
      setDeleteError("Error de conexión");
      setDeleting(false);
    }
  };

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
      genero: user.genero === "LGTBQ+" ? "Otro" : (user.genero || ""),
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
                  {etiquetaGenero(user.genero) || "No especificado"}
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

      {/* Tu cuenta y tus datos */}
      <div style={{ ...styles.card, marginTop: "24px", maxWidth: "1200px", marginLeft: "auto", marginRight: "auto" }}>
        <div style={styles.cardTitle}>Tu cuenta y tus datos</div>
        <div style={{ ...styles.cardText, fontWeight: "normal", marginBottom: "16px" }}>
          Puedes llevarte una copia de tus datos o borrar tu cuenta cuando quieras. Lee cómo usamos tus datos en la{" "}
          <Link to="/privacidad">Política de privacidad</Link> y las reglas en los <Link to="/terminos">Términos</Link>.
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button style={{ ...styles.actionBtn, background: "#fff", color: "#000" }} onClick={descargarDatos}>
            Descargar mis datos
          </button>
          <button
            style={{ ...styles.actionBtn, background: "#fff", color: "#c62828", borderColor: "#c62828", boxShadow: "2px 2px 0 #c62828" }}
            onClick={() => { setShowDelete(true); setDeleteInput(""); setDeleteError(""); }}
          >
            Borrar mi cuenta
          </button>
        </div>
        {datosMsg && <div style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>{datosMsg}</div>}
      </div>

      {/* Confirmación para borrar la cuenta */}
      {showDelete && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}
          onClick={() => !deleting && setShowDelete(false)}
        >
          <div
            role="dialog"
            aria-labelledby="borrar-titulo"
            style={{ background: "#fff", border: "3px solid #000", borderRadius: "16px", boxShadow: "6px 6px 0 #000", padding: "24px", maxWidth: "420px", width: "100%", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="borrar-titulo" style={{ fontSize: "22px", fontWeight: 900, marginBottom: "10px" }}>¿Borrar tu cuenta?</div>
            <div style={{ fontSize: "14px", color: "#333", lineHeight: 1.5, marginBottom: "14px" }}>
              Se borran tu perfil, tus mensajes, tus inscripciones y los eventos que creaste. A quienes estaban inscritos
              en tus próximos eventos les avisaremos que se cancelaron. <strong>No se puede deshacer.</strong>
            </div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
              {user.tienePassword ? "Escribe tu contraseña para confirmar" : "Escribe BORRAR para confirmar"}
            </label>
            <input
              type={user.tienePassword ? "password" : "text"}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "2px solid #333", borderRadius: "8px", fontSize: "15px", marginBottom: "10px" }}
            />
            {deleteError && <div style={{ color: "#c62828", fontSize: "13px", marginBottom: "10px" }}>{deleteError}</div>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button style={{ ...styles.actionBtn, background: "#fff", color: "#000" }} onClick={() => setShowDelete(false)} disabled={deleting}>
                Cancelar
              </button>
              <button
                style={{ ...styles.actionBtn, background: "#c62828", color: "#fff", borderColor: "#c62828", opacity: deleteInput ? 1 : 0.5 }}
                onClick={borrarCuenta}
                disabled={!deleteInput || deleting}
              >
                {deleting ? "Borrando..." : "Borrar mi cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
