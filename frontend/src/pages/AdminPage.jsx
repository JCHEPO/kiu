import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const comunaOptions = ["Concepción", "Talcahuano", "Chiguayante", "San Pedro", "Hualpén", "Penco", "Tomé", "Coronel", "Lota", "Hualqui"];
const tipoOptions = ["fútbol", "básquet", "tenis", "pádel", "vóley", "multiuso"];
const categoriaOptions = [
  { value: "cancha", label: "Cancha" },
  { value: "bar", label: "Bar" },
  { value: "cafetería", label: "Cafetería" },
  { value: "tienda", label: "Tienda" },
  { value: "biblioteca", label: "Biblioteca" },
  { value: "plaza", label: "Plaza" }
];

function SectionHeader({ title, badge, isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 24px", background: "none", border: "none", cursor: "pointer",
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontSize: "20px", fontWeight: 900, color: "#000", textAlign: "left"
      }}
    >
      <span>
        {title}
        {badge !== undefined && (
          <span style={{
            marginLeft: "10px", background: "#000", color: "#fff",
            borderRadius: "20px", padding: "2px 10px", fontSize: "12px", fontWeight: 700
          }}>{badge}</span>
        )}
      </span>
      <span style={{ fontSize: "14px", color: "#666" }}>{isOpen ? "▲" : "▼"}</span>
    </button>
  );
}

export default function AdminPage() {
  const { auth, fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [openSection, setOpenSection] = useState("lugares");

  // --- LUGARES state ---
  const [canchas, setCanchas] = useState([]);
  const [formData, setFormData] = useState({ categoria: "cancha", nombre: "", latitud: "", longitud: "", comuna: "", direccion: "", tipo: [], gratuita: true });
  const [loadingForm, setLoadingForm] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  // bulk import
  const [bulkJson, setBulkJson] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  // inline geocode editor per cancha
  const [editingCanchaId, setEditingCanchaId] = useState(null);
  const [editSearch, setEditSearch] = useState("");
  const [editSearching, setEditSearching] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [editCoords, setEditCoords] = useState(null);

  // --- USUARIOS state ---
  const [users, setUsers] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // --- EVENTOS state ---
  const [adminEvents, setAdminEvents] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // --- VERIFICACIONES state ---
  const [verifications, setVerifications] = useState(null);
  const [loadingVerif, setLoadingVerif] = useState(false);

  useEffect(() => { fetchCanchas(); }, []);

  useEffect(() => {
    if (openSection === "usuarios" && users === null) loadUsers();
    if (openSection === "eventos" && adminEvents === null) loadAdminEvents();
    if (openSection === "verificaciones" && verifications === null) loadVerifications();
  }, [openSection]);

  const toggleSection = (key) => setOpenSection(prev => prev === key ? null : key);

  // --- LUGARES handlers ---
  const fetchCanchas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/canchas`);
      setCanchas(await res.json());
    } catch {}
  };

  const handleSubmitCancha = async (e) => {
    e.preventDefault();
    setLoadingForm(true); setFormMsg("");
    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          ubicacion: { type: "Point", coordinates: [parseFloat(formData.longitud), parseFloat(formData.latitud)] },
          comuna: formData.comuna, direccion: formData.direccion,
          tipo: formData.categoria === "cancha" ? formData.tipo : [],
          categoria: formData.categoria, gratuita: formData.gratuita
        })
      });
      if (res.ok) {
        setFormMsg("✓ Lugar agregado");
        setFormData({ categoria: formData.categoria, nombre: "", latitud: "", longitud: "", comuna: "", direccion: "", tipo: [], gratuita: true });
        fetchCanchas();
      } else {
        const d = await res.json();
        setFormMsg(d.error || "Error al crear");
      }
    } catch { setFormMsg("Error de conexión"); }
    finally { setLoadingForm(false); }
  };

  const handleDeleteCancha = async (id) => {
    if (!window.confirm("¿Eliminar este lugar?")) return;
    const res = await fetchWithAuth(`${API_URL}/api/canchas/${id}`, { method: "DELETE" });
    if (res.ok) setCanchas(prev => prev.filter(c => c._id !== id));
  };

  const detectComuna = (text) => comunaOptions.find(c => text.toLowerCase().includes(c.toLowerCase())) || "";

  const parseGoogleMapsUrl = (url) => {
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    const placeName = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, " ")) : "";
    let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), name: placeName };
    match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), name: placeName };
    match = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), name: placeName };
    return null;
  };

  const resolveGoogleLink = async (q) => {
    let lat = null, lng = null, name = "";
    try {
      const r = await fetch(`${API_URL}/api/canchas/resolve-url?url=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (d.lat && d.lng) { lat = d.lat; lng = d.lng; }
      else if (d.url) {
        const coords = parseGoogleMapsUrl(d.url);
        if (coords) { lat = coords.lat; lng = coords.lng; name = coords.name || ""; }
      }
    } catch {}
    return { lat, lng, name };
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`);
      const d = await r.json();
      const addr = d.address || {};
      return { direccion: [addr.road, addr.house_number].filter(Boolean).join(" "), comuna: detectComuna(d.display_name || ""), displayName: d.display_name || "" };
    } catch { return { direccion: "", comuna: "", displayName: "" }; }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setFormMsg("");
    const q = searchQuery.trim();
    const isGoogleLink = q.includes("google.com/maps") || q.includes("maps.app.goo.gl") || q.includes("goo.gl/maps");
    if (isGoogleLink) {
      const { lat, lng, name } = await resolveGoogleLink(q);
      if (!lat || !lng) {
        setFormMsg("No se pudieron extraer coordenadas del link. Probá pegando la dirección directamente.");
        setSearching(false); return;
      }
      const geo = await reverseGeocode(lat, lng);
      setFormData(prev => ({ ...prev, nombre: name || prev.nombre, latitud: String(lat), longitud: String(lng), direccion: geo.direccion || prev.direccion, comuna: geo.comuna || prev.comuna }));
      setFormMsg("✓ Ubicación encontrada desde Maps");
      setSearching(false); return;
    }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=es&countrycodes=cl`);
      const d = await r.json();
      if (d.length > 0) {
        const geo = await reverseGeocode(d[0].lat, d[0].lon);
        setFormData(prev => ({ ...prev, nombre: d[0].name || prev.nombre, latitud: String(d[0].lat), longitud: String(d[0].lon), direccion: geo.direccion || prev.direccion, comuna: geo.comuna || prev.comuna }));
        setFormMsg("✓ Ubicación encontrada");
      } else { setFormMsg("No se encontró. Intentá con otra dirección o link de Maps."); }
    } catch { setFormMsg("Error al buscar. Verificá tu conexión."); }
    finally { setSearching(false); }
  };

  const handleBulkImport = async () => {
    setBulkLoading(true); setBulkResults(null);
    try {
      const places = JSON.parse(bulkJson);
      const res = await fetchWithAuth(`${API_URL}/api/canchas/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places })
      });
      const data = await res.json();
      setBulkResults(data);
      if (data.ok > 0) { fetchCanchas(); setBulkJson(""); }
    } catch (e) {
      setBulkResults({ error: "JSON inválido: " + e.message });
    } finally { setBulkLoading(false); }
  };

  const openEditCancha = (id) => {
    setEditingCanchaId(id);
    setEditSearch("");
    setEditCoords(null);
    setEditMsg("");
  };

  const handleEditSearch = async () => {
    if (!editSearch.trim()) return;
    setEditSearching(true); setEditMsg(""); setEditCoords(null);
    const q = editSearch.trim();
    const isGoogleLink = q.includes("google.com/maps") || q.includes("maps.app.goo.gl") || q.includes("goo.gl/maps");
    if (isGoogleLink) {
      const { lat, lng } = await resolveGoogleLink(q);
      if (!lat || !lng) {
        setEditMsg("No se pudieron extraer coordenadas del link. Probá pegando la dirección directamente.");
        setEditSearching(false); return;
      }
      const geo = await reverseGeocode(lat, lng);
      setEditCoords({ lat, lng, direccion: geo.direccion, comuna: geo.comuna });
      setEditMsg("✓ Ubicación encontrada desde Maps");
      setEditSearching(false); return;
    }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=es&countrycodes=cl`);
      const d = await r.json();
      if (d.length > 0) {
        const geo = await reverseGeocode(d[0].lat, d[0].lon);
        setEditCoords({ lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), direccion: geo.direccion, comuna: geo.comuna });
        setEditMsg("✓ Ubicación encontrada");
      } else {
        setEditMsg("No se encontró. Intentá con otra dirección.");
      }
    } catch { setEditMsg("Error al buscar. Verificá tu conexión."); }
    finally { setEditSearching(false); }
  };

  const handleSaveGeocode = async (id) => {
    if (!editCoords) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ubicacion: { type: "Point", coordinates: [editCoords.lng, editCoords.lat] },
          direccion: editCoords.direccion,
          comuna: editCoords.comuna || undefined
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCanchas(prev => prev.map(c => c._id === id ? updated : c));
        setEditingCanchaId(null);
      } else {
        setEditMsg("Error al guardar");
      }
    } catch { setEditMsg("Error de conexión"); }
  };

  // --- USUARIOS handlers ---
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/users`);
      setUsers(await res.json());
    } catch { setUsers([]); }
    finally { setLoadingUsers(false); }
  };

  const updateUser = async (id, update) => {
    const res = await fetchWithAuth(`${API_URL}/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update)
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(prev => prev.map(u => u._id === id ? updated : u));
      if (verifications) setVerifications(prev => prev.filter(u => u._id !== id || updated.solicitaVerificacion));
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("¿Estás seguro de que querés eliminar este usuario?\nEsta acción no se puede deshacer.")) return;
    const res = await fetchWithAuth(`${API_URL}/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) setUsers(prev => prev.filter(u => u._id !== id));
  };

  // --- EVENTOS handlers ---
  const loadAdminEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/events`);
      setAdminEvents(await res.json());
    } catch { setAdminEvents([]); }
    finally { setLoadingEvents(false); }
  };

  const deleteAdminEvent = async (id) => {
    if (!window.confirm("¿Eliminar este evento?")) return;
    const res = await fetchWithAuth(`${API_URL}/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) setAdminEvents(prev => prev.filter(e => e._id !== id));
  };

  // --- VERIFICACIONES handlers ---
  const loadVerifications = async () => {
    setLoadingVerif(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/verificaciones`);
      setVerifications(await res.json());
    } catch { setVerifications([]); }
    finally { setLoadingVerif(false); }
  };

  // Guard: admin only
  if (!auth || auth.user?.rol !== "admin") {
    return (
      <div style={S.wrapper}>
        <div style={{ textAlign: "center", padding: "100px 40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <div style={{ fontSize: "24px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginBottom: "12px" }}>Acceso restringido</div>
          <div style={{ fontSize: "16px", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginBottom: "24px" }}>No tienes permisos para ver esta página</div>
          <button onClick={() => navigate("/")} style={S.btnBack}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const filteredUsers = (users || []).filter(u =>
    !userSearch || `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div style={S.wrapper}>
      <div style={S.topBar}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <span style={S.logo}>Kiu</span>
        </button>
        <span style={{ fontSize: "18px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>Panel Admin</span>
        <span style={{ fontSize: "14px", color: "#888", fontFamily: '"Patrick Hand", system-ui, cursive' }}>{auth.user?.email}</span>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: isMobile ? "16px" : "40px" }}>
        <h1 style={S.pageTitle}>Administración</h1>

        {/* ── LUGARES ── */}
        <div style={S.card}>
          <SectionHeader title="Lugares" badge={canchas.length} isOpen={openSection === "lugares"} onClick={() => toggleSection("lugares")} />
          {openSection === "lugares" && (
            <div style={{ padding: "0 24px 24px" }}>

              {/* Search geocode */}
              <div style={S.formGroup}>
                <label style={S.label}>Buscar por dirección o link de Google Maps</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" style={{ ...S.input, flex: 1 }} placeholder='Ej: "Av. Pedro de Valdivia 1161, Concepción"'
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }} />
                  <button type="button" onClick={handleSearch} disabled={searching} style={S.btnSmall}>
                    {searching ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              {formMsg && <div style={{ ...S.msg, color: formMsg.startsWith("✓") ? "#2e7d32" : "#c62828", background: formMsg.startsWith("✓") ? "#e8f5e9" : "#ffebee" }}>{formMsg}</div>}

              <div style={S.divider} />

              {/* Add form */}
              <form onSubmit={handleSubmitCancha}>
                <div style={S.formGroup}>
                  <label style={S.label}>Tipo de lugar</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {categoriaOptions.map(cat => (
                      <button key={cat.value} type="button" onClick={() => setFormData({ ...formData, categoria: cat.value, tipo: [] })}
                        style={S.chip(formData.categoria === cat.value)}>{cat.label}</button>
                    ))}
                  </div>
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>{formData.categoria === "cancha" ? "Nombre de la cancha" : `Nombre del ${formData.categoria}`}</label>
                  <input type="text" style={S.input} placeholder="Ej: Cancha Parque Ecuador" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>Latitud</label>
                    <input type="number" step="any" style={S.input} placeholder="-36.8270" value={formData.latitud} onChange={e => setFormData({ ...formData, latitud: e.target.value })} required />
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>Longitud</label>
                    <input type="number" step="any" style={S.input} placeholder="-73.0498" value={formData.longitud} onChange={e => setFormData({ ...formData, longitud: e.target.value })} required />
                  </div>
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Comuna</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {comunaOptions.map(c => <button key={c} type="button" style={S.chip(formData.comuna === c)} onClick={() => setFormData({ ...formData, comuna: c })}>{c}</button>)}
                  </div>
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Dirección</label>
                  <input type="text" style={S.input} placeholder="Ej: Av. Los Carrera 1234" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                </div>
                {formData.categoria === "cancha" && (
                  <>
                    <div style={S.formGroup}>
                      <label style={S.label}>Acceso</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {[{ value: true, label: "Gratuita" }, { value: false, label: "Pagada" }].map(opt => (
                          <button key={String(opt.value)} type="button" style={S.chip(formData.gratuita === opt.value)} onClick={() => setFormData({ ...formData, gratuita: opt.value })}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>Tipo de deporte</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {tipoOptions.map(t => {
                          const sel = formData.tipo.includes(t);
                          return <button key={t} type="button" style={S.chip(sel)} onClick={() => {
                            if (t === "multiuso") setFormData({ ...formData, tipo: sel ? [] : ["multiuso"] });
                            else { const wo = formData.tipo.filter(x => x !== "multiuso"); setFormData({ ...formData, tipo: sel ? wo.filter(x => x !== t) : [...wo, t] }); }
                          }}>{t}</button>;
                        })}
                      </div>
                    </div>
                  </>
                )}
                <button type="submit" style={S.submitBtn} disabled={loadingForm}>
                  {loadingForm ? "Guardando..." : `Agregar ${formData.categoria}`}
                </button>
              </form>

              {/* Bulk import */}
              <div style={{ marginTop: "32px" }}>
                <div style={S.divider} />
                <h3 style={{ ...S.cardTitle, fontSize: "17px", marginTop: "20px" }}>Importar en masa (JSON)</h3>
                <textarea
                  style={{ ...S.input, height: "140px", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
                  placeholder={`[\n  {\n    "nombre": "Cancha Municipal",\n    "direccion": "Av. Los Presidentes 1549",\n    "comuna": "Concepción",\n    "categoria": "cancha",\n    "tipo": ["fútbol"],\n    "gratuita": true\n  }\n]`}
                  value={bulkJson}
                  onChange={e => setBulkJson(e.target.value)}
                />
                <button style={S.btnSmall} onClick={handleBulkImport} disabled={bulkLoading || !bulkJson.trim()}>
                  {bulkLoading ? "Importando..." : "Importar"}
                </button>
                {bulkResults && (
                  <div style={{ marginTop: "10px", fontSize: "13px", fontFamily: '"Patrick Hand", system-ui, cursive' }}>
                    {bulkResults.error
                      ? <span style={{ color: "#c62828" }}>{bulkResults.error}</span>
                      : <><span style={{ color: "#2e7d32" }}>✓ {bulkResults.ok}/{bulkResults.total} importados</span>
                        {bulkResults.results?.filter(r => r.error).map((r, i) => (
                          <div key={i} style={{ color: "#c62828" }}>✗ {r.nombre}: {r.error}</div>
                        ))}</>
                    }
                  </div>
                )}
              </div>

              {/* List */}
              <div style={{ marginTop: "28px" }}>
                <div style={S.divider} />
                <h3 style={{ ...S.cardTitle, fontSize: "17px", marginTop: "20px" }}>Registrados ({canchas.length})</h3>
                {canchas.length === 0
                  ? <div style={S.empty}>No hay lugares</div>
                  : canchas.map(c => {
                    const hasCoords = c.ubicacion?.coordinates?.length === 2;
                    const isEditing = editingCanchaId === c._id;
                    return (
                      <div key={c._id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ ...S.row, borderBottom: "none" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={S.rowTitle}>{c.nombre}</span>
                              {!hasCoords && <span style={{ ...S.badgeRed, fontSize: "10px" }}>Sin coords</span>}
                            </div>
                            <div style={S.rowSub}>[{c.categoria || "cancha"}] {c.comuna}{c.direccion ? ` · ${c.direccion}` : ""}{c.tipo?.length ? ` · ${c.tipo.join(", ")}` : ""}{c.categoria === "cancha" ? ` · ${c.gratuita === false ? "Pagada" : "Gratuita"}` : ""}{hasCoords ? ` · 📍 ${c.ubicacion.coordinates[1].toFixed(4)}, ${c.ubicacion.coordinates[0].toFixed(4)}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => isEditing ? setEditingCanchaId(null) : openEditCancha(c._id)} style={isEditing ? S.btnOutline : S.btnPrimary}>
                              {isEditing ? "Cancelar" : "📍 Ubicar"}
                            </button>
                            <button onClick={() => handleDeleteCancha(c._id)} style={S.btnDanger}>Eliminar</button>
                          </div>
                        </div>
                        {isEditing && (
                          <div style={{ padding: "12px 0 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <input
                                type="text"
                                style={{ ...S.input, flex: 1, fontSize: "13px", padding: "8px 12px" }}
                                placeholder='Dirección o link de Google Maps...'
                                value={editSearch}
                                onChange={e => setEditSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleEditSearch(); } }}
                                autoFocus
                              />
                              <button style={S.btnSmall} onClick={handleEditSearch} disabled={editSearching}>
                                {editSearching ? "..." : "Buscar"}
                              </button>
                            </div>
                            {editMsg && (
                              <div style={{ fontSize: "12px", fontFamily: '"Patrick Hand", system-ui, cursive', color: editMsg.startsWith("✓") ? "#2e7d32" : "#c62828", fontWeight: 600 }}>
                                {editMsg}
                                {editCoords && ` → ${editCoords.lat.toFixed(5)}, ${editCoords.lng.toFixed(5)}${editCoords.direccion ? " · " + editCoords.direccion : ""}${editCoords.comuna ? " · " + editCoords.comuna : ""}`}
                              </div>
                            )}
                            {editCoords && (
                              <button style={{ ...S.btnSmall, background: "#2e7d32", alignSelf: "flex-start" }} onClick={() => handleSaveGeocode(c._id)}>
                                Guardar ubicación
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}
        </div>

        {/* ── USUARIOS ── */}
        <div style={S.card}>
          <SectionHeader title="Usuarios" badge={users?.length} isOpen={openSection === "usuarios"} onClick={() => toggleSection("usuarios")} />
          {openSection === "usuarios" && (
            <div style={{ padding: "0 24px 24px" }}>
              {loadingUsers
                ? <div style={S.empty}>Cargando...</div>
                : <>
                  <input type="text" style={{ ...S.input, marginBottom: "16px" }} placeholder="Buscar por nombre o email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                  {filteredUsers.length === 0
                    ? <div style={S.empty}>No hay usuarios</div>
                    : filteredUsers.map(u => (
                      <div key={u._id} style={S.row}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={S.rowTitle}>{u.nombre || "—"} {u.apellido || ""}</span>
                            {u.verificado && <span style={S.badgeBlue}>✓ Verificado</span>}
                            {!u.activo && <span style={S.badgeRed}>Baneado</span>}
                            {u.strikes > 0 && <span style={S.badgeYellow}>⚠ {u.strikes} strikes</span>}
                          </div>
                          <div style={S.rowSub}>{u.email} · {u.genero || "género no especificado"} · desde {formatDate(u.fechaRegistro)}</div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                          <button style={u.activo ? S.btnDanger : S.btnGreen} onClick={() => updateUser(u._id, { activo: !u.activo })}>
                            {u.activo ? "Banear" : "Desbanear"}
                          </button>
                          {!u.verificado && (
                            <button style={S.btnPrimary} onClick={() => updateUser(u._id, { verificado: true })}>Verificar</button>
                          )}
                          {u.verificado && (
                            <button style={S.btnOutline} onClick={() => updateUser(u._id, { verificado: false })}>Quitar verif.</button>
                          )}
                          <button style={S.btnDanger} onClick={() => deleteUser(u._id)}>Eliminar</button>
                        </div>
                      </div>
                    ))
                  }
                </>
              }
            </div>
          )}
        </div>

        {/* ── EVENTOS ── */}
        <div style={S.card}>
          <SectionHeader title="Eventos" badge={adminEvents?.length} isOpen={openSection === "eventos"} onClick={() => toggleSection("eventos")} />
          {openSection === "eventos" && (
            <div style={{ padding: "0 24px 24px" }}>
              {loadingEvents
                ? <div style={S.empty}>Cargando...</div>
                : adminEvents?.length === 0
                  ? <div style={S.empty}>No hay eventos</div>
                  : (() => {
                    const now = new Date();
                    const activeEvs = (adminEvents || []).filter(ev => new Date(ev.date) >= now);
                    const pastEvs = (adminEvents || []).filter(ev => new Date(ev.date) < now);
                    const renderEvent = (ev) => {
                      const total = (ev.participants?.length || 0) + (ev.manualParticipants?.length || 0);
                      return (
                        <div key={ev._id} style={S.row}>
                          <div style={{ flex: 1 }}>
                            <div style={S.rowTitle}>{ev.title}</div>
                            <div style={S.rowSub}>
                              Por {ev.creator?.nombre || ev.creator?.email || "—"} · {ev.category} · {total}/{ev.maxParticipants} personas · {formatDate(ev.date)}
                              {ev.location ? ` · ${ev.location}` : ""}
                            </div>
                          </div>
                          <button style={S.btnDanger} onClick={() => deleteAdminEvent(ev._id)}>Eliminar</button>
                        </div>
                      );
                    };
                    return (
                      <>
                        <div style={{ marginBottom: "4px" }}>
                          <div style={{ fontSize: "13px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#2e7d32", padding: "10px 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Activos ({activeEvs.length})
                          </div>
                          {activeEvs.length === 0
                            ? <div style={{ ...S.empty, padding: "10px 0" }}>Sin eventos activos</div>
                            : activeEvs.map(renderEvent)
                          }
                        </div>
                        <div style={{ ...S.divider, margin: "12px 0" }} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#999", padding: "4px 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Pasados ({pastEvs.length})
                          </div>
                          {pastEvs.length === 0
                            ? <div style={{ ...S.empty, padding: "10px 0" }}>Sin eventos pasados</div>
                            : pastEvs.map(renderEvent)
                          }
                        </div>
                      </>
                    );
                  })()
              }
            </div>
          )}
        </div>

        {/* ── VERIFICACIONES ── */}
        <div style={S.card}>
          <SectionHeader title="Solicitudes de verificación" badge={verifications?.length} isOpen={openSection === "verificaciones"} onClick={() => toggleSection("verificaciones")} />
          {openSection === "verificaciones" && (
            <div style={{ padding: "0 24px 24px" }}>
              {loadingVerif
                ? <div style={S.empty}>Cargando...</div>
                : verifications?.length === 0
                  ? <div style={S.empty}>No hay solicitudes pendientes</div>
                  : (verifications || []).map(u => (
                    <div key={u._id} style={S.row}>
                      <div style={{ flex: 1 }}>
                        <div style={S.rowTitle}>{u.nombre || "—"} {u.apellido || ""}</div>
                        <div style={S.rowSub}>{u.email} · {u.genero || "—"} · desde {formatDate(u.fechaRegistro)}</div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={S.btnGreen} onClick={() => updateUser(u._id, { verificado: true, solicitaVerificacion: false })}>Aprobar</button>
                        <button style={S.btnDanger} onClick={() => updateUser(u._id, { solicitaVerificacion: false })}>Rechazar</button>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Styles object
const S = {
  wrapper: { minHeight: "100vh", backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed", backgroundColor: "#e8e8e8" },
  topBar: { position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 40px", background: "rgba(255,255,255,0.95)", borderBottom: "3px solid #333" },
  logo: { fontSize: "28px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#000" },
  pageTitle: { fontSize: "36px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#000", marginBottom: "24px" },
  card: { background: "rgba(255,255,255,0.92)", borderRadius: "16px", border: "3px solid #333", marginBottom: "16px", overflow: "hidden" },
  cardTitle: { fontSize: "22px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginBottom: "16px", color: "#000" },
  formGroup: { marginBottom: "14px" },
  label: { display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "6px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', color: "#555" },
  input: { width: "100%", padding: "11px 14px", border: "2px solid #ddd", borderRadius: "8px", fontSize: "15px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', outline: "none", boxSizing: "border-box" },
  submitBtn: { width: "100%", padding: "13px", backgroundColor: "#000", color: "#fff", border: "3px solid #000", borderRadius: "0px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', boxShadow: "3px 3px 0 #333", textTransform: "uppercase", marginTop: "6px" },
  btnSmall: { padding: "10px 18px", background: "#000", color: "#fff", border: "2px solid #000", borderRadius: "8px", fontSize: "13px", fontWeight: 700, fontFamily: '"Patrick Hand", system-ui, cursive', cursor: "pointer", whiteSpace: "nowrap" },
  btnDanger: { padding: "7px 14px", background: "#fff", color: "#ff4444", border: "2px solid #ff4444", borderRadius: "8px", fontSize: "12px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', cursor: "pointer", whiteSpace: "nowrap" },
  btnGreen: { padding: "7px 14px", background: "#fff", color: "#2e7d32", border: "2px solid #2e7d32", borderRadius: "8px", fontSize: "12px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', cursor: "pointer", whiteSpace: "nowrap" },
  btnPrimary: { padding: "7px 14px", background: "#000", color: "#fff", border: "2px solid #000", borderRadius: "8px", fontSize: "12px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', cursor: "pointer", whiteSpace: "nowrap" },
  btnOutline: { padding: "7px 14px", background: "#fff", color: "#555", border: "2px solid #aaa", borderRadius: "8px", fontSize: "12px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', cursor: "pointer", whiteSpace: "nowrap" },
  btnBack: { padding: "14px 30px", background: "#000", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' },
  chip: (active) => ({ padding: "7px 14px", borderRadius: "20px", border: active ? "2px solid #000" : "2px solid #ccc", background: active ? "#000" : "#fff", color: active ? "#fff" : "#000", fontSize: "13px", fontWeight: 600, fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', cursor: "pointer" }),
  msg: { padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px", fontWeight: 600, fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' },
  divider: { height: "1px", background: "#eee", margin: "0 0 0 0" },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" },
  rowTitle: { fontSize: "15px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#000" },
  rowSub: { fontSize: "12px", color: "#777", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginTop: "2px" },
  empty: { textAlign: "center", padding: "24px", color: "#999", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' },
  badgeBlue: { background: "#e3f2fd", color: "#1565c0", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' },
  badgeRed: { background: "#ffebee", color: "#c62828", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' },
  badgeYellow: { background: "#fff8e1", color: "#f57f17", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' }
};
