import React, { useContext, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import { API_URL } from "../config/api";

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

  // Calendario automático (suscripción al link .ics personal)
  const [calToken, setCalToken] = useState(null);
  const [calMsg, setCalMsg] = useState("");
  const calUrl = calToken ? `${API_URL}/api/calendario/${calToken}.ics` : "";
  const pedirCalendario = async (renovar = false) => {
    setCalMsg("");
    const res = await fetchWithAuth(`${API_URL}/api/auth/me/calendario${renovar ? "/renovar" : ""}`, { method: renovar ? "POST" : "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setCalMsg(data.error || "No se pudo obtener el link"); return null; }
    setCalToken(data.token);
    if (renovar) setCalMsg("Listo: el link anterior dejó de funcionar. Vuelve a suscribirte con el nuevo.");
    return data.token;
  };

  // Strikes: los míos y apelar
  const [misStrikes, setMisStrikes] = useState(null);
  const [apelando, setApelando] = useState(null); // id del strike que se está apelando
  const [apelacionTexto, setApelacionTexto] = useState("");
  const [apelacionMsg, setApelacionMsg] = useState("");

  const cargarStrikes = () => {
    fetchWithAuth(`${API_URL}/api/auth/me/strikes`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setMisStrikes(data))
      .catch(() => setMisStrikes(null));
  };

  const enviarApelacion = async (strikeId) => {
    setApelacionMsg("");
    const res = await fetchWithAuth(`${API_URL}/api/auth/me/strikes/${strikeId}/apelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: apelacionTexto })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setApelacionMsg(data.error || "No se pudo enviar la apelación"); return; }
    setApelando(null);
    setApelacionTexto("");
    setApelacionMsg(data.message || "Apelación enviada");
    cargarStrikes();
  };

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
    cargarStrikes();
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

        {/* Calendario automático */}
        <div style={{ ...styles.card, background: "#fff" }}>
          <div>
            <div style={styles.cardTitle}>Calendario</div>
            <div style={styles.cardText}>
              Suscribe tu calendario y los eventos a los que te unes aparecen solos (y se borran si se cancelan). Es opcional.
            </div>
            {!calToken ? (
              <button style={{ ...styles.actionBtn, background: "#000", color: "#fff", marginTop: "12px" }} onClick={() => pedirCalendario()}>
                📅 Activar calendario automático
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                <a style={{ ...styles.actionBtn, background: "#000", color: "#fff", textDecoration: "none" }} href={calUrl.replace(/^https?:/, "webcal:")}>
                  iPhone / Mac
                </a>
                <a style={{ ...styles.actionBtn, background: "#fff", color: "#000", textDecoration: "none" }} target="_blank" rel="noopener noreferrer"
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calUrl.replace(/^https?:/, "webcal:"))}`}>
                  Google Calendar
                </a>
                <button style={{ ...styles.actionBtn, background: "#fff", color: "#000" }} onClick={async () => {
                  try { await navigator.clipboard.writeText(calUrl); setCalMsg("Link copiado"); } catch { window.prompt("Copia este link:", calUrl); }
                }}>
                  Copiar link
                </button>
                <button style={{ ...styles.actionBtn, background: "#fff", color: "#000" }} onClick={() => {
                  if (window.confirm("Se crea un link nuevo y el anterior deja de funcionar. ¿Seguir?")) pedirCalendario(true);
                }}>
                  Cambiar link
                </button>
              </div>
            )}
            {calToken && (
              <div style={{ ...styles.cardText, fontSize: "13px", marginTop: "8px" }}>
                No compartas este link: muestra tus eventos. Los cambios pueden tardar unas horas en verse según tu calendario.
              </div>
            )}
            {calMsg && <div style={{ marginTop: "8px", fontSize: "13px", color: "#555", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>{calMsg}</div>}
          </div>
        </div>

        {/* Strikes */}
        {misStrikes && (misStrikes.strikes.length > 0 || user.suspendidoHasta) && (
          <div style={{ ...styles.card, background: "#fff" }}>
            <div>
              <div style={styles.cardTitle}>Strikes</div>
              {user.suspendidoHasta && new Date(user.suspendidoHasta) > new Date() && (
                <div style={{ background: "#ffebee", color: "#b71c1c", border: "2px solid #b71c1c", borderRadius: "10px", padding: "10px 12px", margin: "8px 0 12px", fontSize: "14px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
                  Tu cuenta está suspendida hasta el {new Date(user.suspendidoHasta).toLocaleString("es-CL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}. Mientras tanto no puedes crear eventos ni unirte.
                </div>
              )}
              <div style={styles.cardText}>
                Tienes {misStrikes.activos} de {misStrikes.maximo} strikes activos. Cada uno vence a los {misStrikes.diasVigencia} días; con {misStrikes.maximo} la cuenta se suspende 7 días (30 si se repite). Si uno es un error, apélalo.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                {misStrikes.strikes.map(k => (
                  <div key={k._id} style={{ border: "2px solid #ddd", borderRadius: "10px", padding: "10px 12px", opacity: k.activo ? 1 : 0.55, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
                    <div style={{ fontSize: "14px", fontWeight: 800 }}>
                      {{ inasistencia: "No llegaste", cancelacion_tarde: "Saliste a menos de 6 horas", conducta: "Reporte de conducta" }[k.tipo] || k.tipo}
                      {k.evento ? ` · ${k.evento}` : ""}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      {new Date(k.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                      {k.anulado ? " · anulado" : k.activo ? ` · vence el ${new Date(k.vence).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}` : " · vencido"}
                      {k.apelacion === "pendiente" && " · apelación en revisión"}
                      {k.apelacion === "aceptada" && " · apelación aceptada"}
                      {k.apelacion === "rechazada" && " · apelación rechazada"}
                    </div>
                    {k.activo && k.apelacion === "ninguna" && (
                      apelando === k._id ? (
                        <div style={{ marginTop: "8px" }}>
                          <textarea
                            value={apelacionTexto}
                            onChange={e => setApelacionTexto(e.target.value)}
                            maxLength={500}
                            rows={3}
                            placeholder="Cuéntanos qué pasó (por ejemplo: sí llegué, avisé por el muro...)"
                            style={{ width: "100%", boxSizing: "border-box", border: "2px solid #333", borderRadius: "8px", padding: "8px", fontSize: "14px", fontFamily: "inherit" }}
                          />
                          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                            <button style={{ ...styles.actionBtn, background: "#000", color: "#fff" }} onClick={() => enviarApelacion(k._id)}>Enviar</button>
                            <button style={{ ...styles.actionBtn, background: "#fff", color: "#000" }} onClick={() => { setApelando(null); setApelacionTexto(""); }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button style={{ ...styles.actionBtn, background: "#fff", color: "#000", marginTop: "8px" }} onClick={() => { setApelando(k._id); setApelacionMsg(""); }}>
                          Apelar
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
              {apelacionMsg && <div style={{ marginTop: "8px", fontSize: "13px", color: "#555", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>{apelacionMsg}</div>}
            </div>
          </div>
        )}

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
