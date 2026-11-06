import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import { API_URL } from "../config/api";

const comunaOptions = ["Concepción", "Talcahuano", "Chiguayante", "San Pedro", "Hualpén", "Penco", "Tomé", "Coronel", "Lota", "Hualqui"];
const tipoOptions = ["fútbol", "básquet", "tenis", "pádel", "vóley", "multiuso"];
// En la base el campo se llama "gratuita" (true = uso libre); en pantalla se habla de reservar
const OPCIONES_RESERVA = [{ value: true, label: "Uso libre" }, { value: false, label: "Se reserva" }];
const textoReserva = (c) => c.gratuita === false ? "Se reserva" : "Uso libre";
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

  const [openSection, setOpenSection] = useState("metricas");

  // --- MÉTRICAS y REPORTES state ---
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [reports, setReports] = useState(null);
  const [reportsEstado, setReportsEstado] = useState("pendiente");
  const [loadingReports, setLoadingReports] = useState(false);
  const [apelaciones, setApelaciones] = useState(null);
  const [loadingApelaciones, setLoadingApelaciones] = useState(false);

  // --- LUGARES state ---
  const [canchas, setCanchas] = useState([]);
  // gratuita: true = uso libre (no se reserva), false = se reserva
  const FORM_VACIO = { categoria: "cancha", nombre: "", latitud: "", longitud: "", comuna: "", direccion: "", tipo: [], gratuita: true, tieneLuz: false };
  const [formData, setFormData] = useState(FORM_VACIO);
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
  const [editFields, setEditFields] = useState(null);
  // importar desde OpenStreetMap
  const [osmComuna, setOsmComuna] = useState("");
  const [osmLoading, setOsmLoading] = useState(false);
  const [osmError, setOsmError] = useState("");
  const [osmLugares, setOsmLugares] = useState(null);
  const [osmImportando, setOsmImportando] = useState(false);
  const [osmResultado, setOsmResultado] = useState(null);

  // --- LOCALES (eventos promocionados) state ---
  const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const [localesMes, setLocalesMes] = useState(mesActual);
  const [locales, setLocales] = useState(null);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [copiadoLocal, setCopiadoLocal] = useState(null);

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
    if (openSection === "metricas" && metrics === null) loadMetrics();
    if (openSection === "reportes" && reports === null) loadReports("pendiente");
    if (openSection === "apelaciones" && apelaciones === null) loadApelaciones();
    if (openSection === "locales" && locales === null) loadLocales(localesMes);
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
          categoria: formData.categoria, gratuita: formData.gratuita,
          tieneLuz: formData.categoria === "cancha" && formData.tieneLuz
        })
      });
      if (res.ok) {
        setFormMsg("✓ Lugar agregado");
        setFormData({ ...FORM_VACIO, categoria: formData.categoria });
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
      const r = await fetchWithAuth(`${API_URL}/api/canchas/resolve-url?url=${encodeURIComponent(q)}`);
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

  const openEditCancha = (c) => {
    setEditingCanchaId(c._id);
    setEditSearch("");
    setEditCoords(null);
    setEditMsg("");
    setEditFields({ nombre: c.nombre || "", tipo: c.tipo || [], gratuita: c.gratuita !== false, tieneLuz: !!c.tieneLuz, categoria: c.categoria || "cancha" });
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

  // Guarda los datos editados y, si se buscó una ubicación nueva, también la ubicación
  const handleSaveCancha = async (id) => {
    if (!editFields?.nombre.trim()) { setEditMsg("El nombre no puede quedar vacío"); return; }
    const body = { nombre: editFields.nombre.trim() };
    if (editFields.categoria === "cancha") {
      body.tipo = editFields.tipo;
      body.gratuita = editFields.gratuita;
      body.tieneLuz = editFields.tieneLuz;
    }
    if (editCoords) {
      body.ubicacion = { type: "Point", coordinates: [editCoords.lng, editCoords.lat] };
      body.direccion = editCoords.direccion;
      if (editCoords.comuna) body.comuna = editCoords.comuna;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const updated = await res.json();
        setCanchas(prev => prev.map(c => c._id === id ? updated : c));
        setEditingCanchaId(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setEditMsg(d.error || "Error al guardar");
      }
    } catch { setEditMsg("Error de conexión"); }
  };

  // --- OpenStreetMap ---
  const buscarOsm = async () => {
    if (!osmComuna) return;
    setOsmLoading(true); setOsmError(""); setOsmLugares(null); setOsmResultado(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas/osm?comuna=${encodeURIComponent(osmComuna)}`);
      const d = await res.json();
      if (!res.ok) { setOsmError(d.error || "No se pudo consultar OpenStreetMap"); return; }
      // Vienen marcadas las que conviene importar: no repetidas y no privadas
      setOsmLugares(d.lugares.map(l => ({ ...l, elegida: !l.yaImportada && !l.cercana && !l.privada })));
    } catch { setOsmError("Error de conexión"); }
    finally { setOsmLoading(false); }
  };

  const cambiarOsm = (osmId, cambios) => setOsmLugares(prev => prev.map(l => l.osmId === osmId ? { ...l, ...cambios } : l));

  const importarOsm = async () => {
    const elegidas = (osmLugares || []).filter(l => l.elegida && !l.yaImportada);
    if (!elegidas.length) return;
    setOsmImportando(true); setOsmResultado(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas/osm/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lugares: elegidas.map(l => ({ osmId: l.osmId, nombre: l.nombre, lat: l.lat, lng: l.lng, comuna: l.comuna, direccion: l.direccion, tipo: l.tipo, tieneLuz: l.tieneLuz, seReserva: l.seReserva })) })
      });
      const d = await res.json();
      if (!res.ok) { setOsmResultado({ error: d.error || "Error al importar" }); return; }
      setOsmResultado(d);
      const ok = new Set(d.resultados.filter(r => r.ok).map(r => r.osmId));
      setOsmLugares(prev => prev.map(l => ok.has(l.osmId) ? { ...l, yaImportada: true, elegida: false } : l));
      fetchCanchas();
    } catch { setOsmResultado({ error: "Error de conexión" }); }
    finally { setOsmImportando(false); }
  };

  // --- LOCALES handlers ---
  const loadLocales = async (mes) => {
    setLoadingLocales(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/locales?mes=${encodeURIComponent(mes)}`);
      const d = await res.json();
      setLocales(res.ok ? d : { error: d.error || "Error al cargar" });
    } catch { setLocales({ error: "Error de conexión" }); }
    finally { setLoadingLocales(false); }
  };

  const nombreMes = (mes) => {
    const [a, m] = mes.split("-").map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  };
  const pesos = (n) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;

  // Resumen para mandarle al local por WhatsApp o correo
  const resumenLocal = (l) => [
    `Kiu · ${l.nombre} · ${nombreMes(locales.mes)}`,
    ...l.eventos.map(e => `- ${new Date(e.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} ${e.title}: ${e.llegaron} llegaron${e.noSeJugo ? " (no se realizó, $0)" : ` × ${pesos(e.tarifa)} = ${pesos(e.monto)}`}`),
    `Total: ${l.llegaron} personas · ${pesos(l.monto)}`
  ].join("\n");

  const copiarResumen = async (l) => {
    try { await navigator.clipboard.writeText(resumenLocal(l)); setCopiadoLocal(l.nombre); setTimeout(() => setCopiadoLocal(null), 2000); }
    catch { window.prompt("Copia el resumen:", resumenLocal(l)); }
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
    if (!window.confirm("¿Eliminar este usuario?\nSe borran también sus eventos (se avisa a los inscritos), sus mensajes e inscripciones.\nEsta acción no se puede deshacer.")) return;
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

  // --- MÉTRICAS handlers ---
  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/metrics`);
      setMetrics(res.ok ? await res.json() : { error: true });
    } catch { setMetrics({ error: true }); }
    finally { setLoadingMetrics(false); }
  };

  // --- APELACIONES handlers ---
  const loadApelaciones = async () => {
    setLoadingApelaciones(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/apelaciones`);
      setApelaciones(res.ok ? await res.json() : []);
    } catch { setApelaciones([]); }
    finally { setLoadingApelaciones(false); }
  };

  const resolverApelacion = async (id, apelacion) => {
    const res = await fetchWithAuth(`${API_URL}/api/admin/strikes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apelacion })
    });
    if (res.ok) setApelaciones(prev => prev.filter(a => a._id !== id));
    else alert("No se pudo resolver la apelación");
  };

  // --- REPORTES handlers ---
  const loadReports = async (estado) => {
    setReportsEstado(estado);
    setLoadingReports(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/reports?estado=${estado}`);
      setReports(res.ok ? await res.json() : []);
    } catch { setReports([]); }
    finally { setLoadingReports(false); }
  };

  const resolverReporte = async (id, estado, sumarStrike = false) => {
    const res = await fetchWithAuth(`${API_URL}/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, sumarStrike })
    });
    if (res.ok) setReports(prev => prev.filter(r => r._id !== id));
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

        {/* ── MÉTRICAS DEL PILOTO ── */}
        <div style={S.card}>
          <SectionHeader title="Métricas del piloto" isOpen={openSection === "metricas"} onClick={() => toggleSection("metricas")} />
          {openSection === "metricas" && (
            <div style={{ padding: "0 24px 24px" }}>
              {loadingMetrics || !metrics
                ? <div style={S.empty}>Cargando...</div>
                : metrics.error
                  ? <div style={S.empty}>No se pudieron cargar las métricas</div>
                  : <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                      {metrics.kpis.map(k => {
                        const esNumero = k.formato === "numero";
                        const pct = (v) => esNumero ? String(v) : `${Math.round(v * 100)}%`;
                        const sinDatos = k.valor === null || (!esNumero && !k.denominador);
                        const estado = sinDatos ? "sin" : k.meta === null || k.meta === undefined ? "seguir" : k.valor >= k.meta ? "ok" : "bajo";
                        const badge = estado === "ok"
                          ? { ...S.badgeGreen, text: "✓ Cumple la meta" }
                          : estado === "bajo"
                            ? { ...S.badgeYellow, text: "↓ Bajo la meta" }
                            : estado === "seguir"
                              ? { ...S.badgeGray, text: "Sin meta: se sigue" }
                              : { ...S.badgeGray, text: "… Sin datos aún" };
                        const { text, ...badgeStyle } = badge;
                        return (
                          <div key={k.clave} style={{ border: "2px solid #333", borderRadius: "12px", padding: "16px", background: "#fff" }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#444", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', minHeight: "34px" }}>{k.titulo}</div>
                            <div style={{ fontSize: "40px", fontWeight: 900, lineHeight: 1.1, margin: "8px 0 2px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#000" }}>
                              {k.valor === null ? "—" : pct(k.valor)}
                            </div>
                            <div style={{ fontSize: "13px", color: "#555", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginBottom: "8px" }}>
                              {esNumero ? "en la semana" : `${k.numerador} de ${k.denominador}`}{k.meta !== null && k.meta !== undefined ? ` · meta ${pct(k.meta)}` : ""}
                            </div>
                            <span style={badgeStyle}>{text}</span>
                            <div style={{ fontSize: "12px", color: "#777", marginTop: "10px", lineHeight: 1.4, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>{k.nota}</div>
                          </div>
                        );
                      })}
                    </div>

                    {metrics.embudo && (
                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "15px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginBottom: "8px" }}>Links compartidos · últimos 30 días</div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                          {[
                            ["Abrieron el link", metrics.embudo.aperturas],
                            ["Sin cuenta", metrics.embudo.sinCuenta],
                            ["Crearon cuenta", metrics.embudo.cuentasCreadas],
                            ["Se inscribieron (7 días)", metrics.embudo.inscritos],
                            ["Llegaron al evento", metrics.embudo.asistieron]
                          ].map(([t, n], i) => (
                            <div key={t} style={{ flex: "1 1 120px", border: "2px solid #333", borderRadius: "10px", padding: "10px", background: i === 0 ? "#f7f7f7" : "#fff" }}>
                              <div style={{ fontSize: "24px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', fontVariantNumeric: "tabular-nums" }}>{n}</div>
                              <div style={{ fontSize: "12px", color: "#555", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>{t}</div>
                            </div>
                          ))}
                        </div>
                        {metrics.embudo.porOrigen.length > 0 && (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
                            <thead>
                              <tr>
                                {["Origen", "Abrieron", "Se inscribieron", "%"].map((h, i) => (
                                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px", borderBottom: "2px solid #333" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {metrics.embudo.porOrigen.map(o => (
                                <tr key={o.origen} style={{ borderBottom: "1px solid #eee" }}>
                                  <td style={{ padding: "6px" }}>{{ wa: "WhatsApp", compartir: "Menú compartir", copia: "Link copiado", directo: "Directo / sin origen", qr: "QR" }[o.origen] || o.origen}</td>
                                  <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.aperturas}</td>
                                  <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.inscritos}</td>
                                  <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.aperturas ? `${Math.round(o.inscritos / o.aperturas * 100)}%` : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div style={{ ...S.rowSub, marginTop: "6px" }}>
                          Para un afiche o una historia, agrega <code>?o=</code> al link del evento (p.ej. <code>/event/ID?o=qr-cancha-1</code>) y aparecerá como origen aparte.
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: "15px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginBottom: "8px" }}>Últimas 8 semanas</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
                        <thead>
                          <tr>
                            {["Semana", "Registros", "Eventos creados", "Jugados", "Uniones", "Salidas", "Links abiertos"].map((h, i) => (
                              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 6px", borderBottom: "2px solid #333", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.semanas.map((w, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                              <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                                {new Date(w.desde).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – {new Date(w.hasta).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                              </td>
                              {[w.registro, w.evento_creado, w.jugados ?? 0, w.union, w.salida, w.aperturas ?? 0].map((n, j) => (
                                <td key={j} style={{ padding: "8px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", gap: "8px", flexWrap: "wrap" }}>
                      <span style={S.rowSub}>Actualizado {new Date(metrics.generado).toLocaleString("es-CL")}</span>
                      <button style={S.btnOutline} onClick={loadMetrics}>Actualizar</button>
                    </div>
                  </>
              }
            </div>
          )}
        </div>

        {/* ── LOCALES (eventos promocionados) ── */}
        <div style={S.card}>
          <SectionHeader title="Locales (eventos promocionados)" isOpen={openSection === "locales"} onClick={() => toggleSection("locales")} />
          {openSection === "locales" && (
            <div style={{ padding: "0 24px 24px" }}>
              <div style={S.ayuda}>
                Cuánto le toca pagar a cada local: personas que llegaron × la tarifa de cada evento. Cuenta a quienes marcaron
                su llegada con el código del local y a quienes marcaste como "Llegó". Estos eventos no entran en las métricas del piloto.
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", margin: "12px 0" }}>
                <input type="month" aria-label="Mes" value={localesMes} onChange={e => { setLocalesMes(e.target.value); if (e.target.value) loadLocales(e.target.value); }}
                  style={{ ...S.input, width: "auto" }} />
              </div>
              {loadingLocales || !locales
                ? <div style={S.empty}>Cargando...</div>
                : locales.error
                ? <div style={{ ...S.msg, color: "#c62828", background: "#ffebee" }}>{locales.error}</div>
                : locales.locales.length === 0
                ? <div style={S.empty}>No hubo eventos promocionados en {nombreMes(locales.mes)}.</div>
                : <>
                  <div style={{ ...S.rowTitle, fontSize: "16px", marginBottom: "8px" }}>
                    Total {nombreMes(locales.mes)}: {pesos(locales.total)} · {locales.llegaron} personas llegaron
                  </div>
                  {locales.locales.map(l => (
                    <div key={l.nombre} style={{ border: "2px solid #eee", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <div>
                          <div style={S.rowTitle}>{l.nombre}</div>
                          <div style={S.rowSub}>{l.comuna} · {l.eventos.length} evento{l.eventos.length === 1 ? "" : "s"} · {l.inscritos} inscritos · {l.llegaron} llegaron</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ ...S.rowTitle, fontSize: "18px" }}>{pesos(l.monto)}</span>
                          <button style={S.btnOutline} onClick={() => copiarResumen(l)}>{copiadoLocal === l.nombre ? "✓ Copiado" : "Copiar resumen"}</button>
                        </div>
                      </div>
                      <div style={{ marginTop: "8px", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: '"Patrick Hand", system-ui, cursive' }}>
                          <thead>
                            <tr style={{ textAlign: "left", color: "#666" }}>
                              <th style={{ padding: "4px 6px" }}>Evento</th><th style={{ padding: "4px 6px" }}>Inscritos</th>
                              <th style={{ padding: "4px 6px" }}>Llegaron</th><th style={{ padding: "4px 6px" }}>Tarifa</th><th style={{ padding: "4px 6px" }}>Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {l.eventos.map(e => (
                              <tr key={e._id} style={{ borderTop: "1px solid #f0f0f0" }}>
                                <td style={{ padding: "4px 6px" }}>
                                  <a href={`/event/${e._id}`} style={{ color: "#000" }}>{e.title}</a>
                                  <div style={{ color: "#888", fontSize: "12px" }}>{new Date(e.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}{e.noSeJugo ? " · no se realizó" : ""}</div>
                                </td>
                                <td style={{ padding: "4px 6px" }}>{e.inscritos}</td>
                                <td style={{ padding: "4px 6px" }}>{e.llegaron}{e.porCodigo ? <span style={{ color: "#888" }}> ({e.porCodigo} con código)</span> : null}</td>
                                <td style={{ padding: "4px 6px" }}>{pesos(e.tarifa)}</td>
                                <td style={{ padding: "4px 6px", fontWeight: 700 }}>{pesos(e.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </>}
            </div>
          )}
        </div>

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
                      <label style={S.label}>¿Se reserva?</label>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {OPCIONES_RESERVA.map(opt => (
                          <button key={String(opt.value)} type="button" style={S.chip(formData.gratuita === opt.value)} onClick={() => setFormData({ ...formData, gratuita: opt.value })}>{opt.label}</button>
                        ))}
                      </div>
                      <div style={S.ayuda}>{formData.gratuita ? "Uso libre: no se reserva y puede estar ocupada. Los strikes son más suaves." : "Se reserva (arriendo o reserva en la muni): salir con menos de 6 h de anticipación da strike."}</div>
                    </div>
                    <div style={S.formGroup}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", ...S.label, marginBottom: 0 }}>
                        <input type="checkbox" id="cancha-luz" checked={formData.tieneLuz} onChange={e => setFormData({ ...formData, tieneLuz: e.target.checked })} style={{ width: "18px", height: "18px" }} />
                        💡 Tiene luz (se puede jugar de noche)
                      </label>
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

              {/* Importar desde OpenStreetMap */}
              <div style={{ marginTop: "32px" }}>
                <div style={S.divider} />
                <h3 style={{ ...S.cardTitle, fontSize: "17px", marginTop: "20px" }}>Buscar canchas en OpenStreetMap</h3>
                <div style={S.ayuda}>
                  OpenStreetMap es un mapa libre hecho por voluntarios. Trae canchas de fútbol, básquet y multicanchas de la comuna;
                  revisa cada una antes de importar (nombre, si se reserva y si tiene luz). Muchas no tienen nombre: pónselo tú.
                  Datos © colaboradores de OpenStreetMap (licencia ODbL).
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "12px 0" }}>
                  {comunaOptions.map(c => <button key={c} type="button" style={S.chip(osmComuna === c)} onClick={() => setOsmComuna(c)}>{c}</button>)}
                </div>
                <button id="osm-buscar" style={S.btnSmall} onClick={buscarOsm} disabled={!osmComuna || osmLoading}>
                  {osmLoading ? "Buscando (puede tardar 30 s)..." : osmComuna ? `Buscar en ${osmComuna}` : "Elige una comuna"}
                </button>
                {osmError && <div style={{ ...S.msg, color: "#c62828", background: "#ffebee", marginTop: "10px" }}>{osmError}</div>}
                {osmLugares && (
                  <div style={{ marginTop: "14px" }}>
                    {osmLugares.length === 0
                      ? <div style={S.empty}>OpenStreetMap no tiene canchas de fútbol o básquet en {osmComuna}.</div>
                      : <>
                        <div style={{ ...S.rowSub, marginBottom: "8px" }}>
                          {osmLugares.length} encontradas · {osmLugares.filter(l => l.elegida && !l.yaImportada).length} elegidas para importar
                        </div>
                        {osmLugares.map(l => (
                          <div key={l.osmId} style={{ ...S.row, alignItems: "flex-start", opacity: l.yaImportada ? 0.5 : 1, gap: "10px" }}>
                            <input type="checkbox" aria-label={`Importar ${l.nombre}`} checked={!!l.elegida && !l.yaImportada} disabled={l.yaImportada}
                              onChange={e => cambiarOsm(l.osmId, { elegida: e.target.checked })} style={{ width: "18px", height: "18px", marginTop: "8px" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <input type="text" value={l.nombre} disabled={l.yaImportada} onChange={e => cambiarOsm(l.osmId, { nombre: e.target.value, sinNombre: false })}
                                style={{ ...S.input, padding: "6px 10px", fontSize: "14px", borderColor: l.sinNombre ? "#f9a825" : undefined }} />
                              <div style={{ ...S.rowSub, marginTop: "4px" }}>
                                {l.tipo.join(", ")}{l.direccion ? ` · ${l.direccion}` : ""}{l.superficie ? ` · ${l.superficie}` : ""}
                                {" · "}<a href={`https://www.google.com/maps?q=${l.lat},${l.lng}`} target="_blank" rel="noopener noreferrer">ver en el mapa</a>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                                {l.yaImportada && <span style={S.badgeBlue}>Ya está en el catálogo</span>}
                                {!l.yaImportada && l.cercana && <span style={S.badgeYellow}>Parece repetida: "{l.cercana.nombre}" a {l.cercana.metros} m</span>}
                                {l.privada && <span style={S.badgeRed}>Privada (colegio, club...)</span>}
                                {l.sinNombre && !l.yaImportada && <span style={S.badgeYellow}>Sin nombre en OSM</span>}
                                {!l.yaImportada && OPCIONES_RESERVA.map(opt => (
                                  <button key={String(opt.value)} type="button" style={{ ...S.chip(l.seReserva !== opt.value), padding: "3px 10px", fontSize: "12px" }}
                                    onClick={() => cambiarOsm(l.osmId, { seReserva: !opt.value })}>{opt.label}</button>
                                ))}
                                {!l.yaImportada && (
                                  <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", cursor: "pointer", fontFamily: '"Patrick Hand", system-ui, cursive' }}>
                                    <input type="checkbox" checked={l.tieneLuz} onChange={e => cambiarOsm(l.osmId, { tieneLuz: e.target.checked })} />
                                    💡 Luz{l.luzDesconocida ? " (OSM no dice)" : ""}
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <button id="osm-importar" style={{ ...S.btnSmall, marginTop: "12px" }} onClick={importarOsm}
                          disabled={osmImportando || !osmLugares.some(l => l.elegida && !l.yaImportada)}>
                          {osmImportando ? "Importando..." : `Importar ${osmLugares.filter(l => l.elegida && !l.yaImportada).length} canchas`}
                        </button>
                      </>}
                    {osmResultado && (
                      <div style={{ marginTop: "10px", fontSize: "13px", fontFamily: '"Patrick Hand", system-ui, cursive' }}>
                        {osmResultado.error
                          ? <span style={{ color: "#c62828" }}>{osmResultado.error}</span>
                          : <><span style={{ color: "#2e7d32" }}>✓ {osmResultado.ok}/{osmResultado.total} importadas</span>
                            {osmResultado.resultados?.filter(r => r.error).map((r, i) => <div key={i} style={{ color: "#c62828" }}>✗ {r.nombre}: {r.error}</div>)}</>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bulk import */}
              <div style={{ marginTop: "32px" }}>
                <div style={S.divider} />
                <h3 style={{ ...S.cardTitle, fontSize: "17px", marginTop: "20px" }}>Importar en masa (JSON)</h3>
                <textarea
                  style={{ ...S.input, height: "140px", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
                  placeholder={`[\n  {\n    "nombre": "Cancha Municipal",\n    "direccion": "Av. Los Presidentes 1549",\n    "comuna": "Concepción",\n    "categoria": "cancha",\n    "tipo": ["fútbol"],\n    "seReserva": false,\n    "tieneLuz": true,\n    "lat": -36.8270,\n    "lng": -73.0498\n  }\n]`}
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
                              {c.fuente === "osm" && <span style={{ ...S.badgeBlue, fontSize: "10px" }}>OSM</span>}
                            </div>
                            <div style={S.rowSub}>[{c.categoria || "cancha"}] {c.comuna}{c.direccion ? ` · ${c.direccion}` : ""}{c.tipo?.length ? ` · ${c.tipo.join(", ")}` : ""}{(c.categoria || "cancha") === "cancha" ? ` · ${textoReserva(c)}${c.tieneLuz ? " · 💡 con luz" : ""}` : ""}{hasCoords ? ` · 📍 ${c.ubicacion.coordinates[1].toFixed(4)}, ${c.ubicacion.coordinates[0].toFixed(4)}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => isEditing ? setEditingCanchaId(null) : openEditCancha(c)} style={isEditing ? S.btnOutline : S.btnPrimary}>
                              {isEditing ? "Cancelar" : "Editar"}
                            </button>
                            <button onClick={() => handleDeleteCancha(c._id)} style={S.btnDanger}>Eliminar</button>
                          </div>
                        </div>
                        {isEditing && editFields && (
                          <div style={{ padding: "12px 0 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <input type="text" aria-label="Nombre" style={{ ...S.input, fontSize: "14px", padding: "8px 12px" }} value={editFields.nombre}
                              onChange={e => setEditFields({ ...editFields, nombre: e.target.value })} />
                            {editFields.categoria === "cancha" && (
                              <>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                  {tipoOptions.map(t => {
                                    const sel = editFields.tipo.includes(t);
                                    return <button key={t} type="button" style={{ ...S.chip(sel), padding: "4px 10px", fontSize: "12px" }} onClick={() => {
                                      if (t === "multiuso") setEditFields({ ...editFields, tipo: sel ? [] : ["multiuso"] });
                                      else { const wo = editFields.tipo.filter(x => x !== "multiuso"); setEditFields({ ...editFields, tipo: sel ? wo.filter(x => x !== t) : [...wo, t] }); }
                                    }}>{t}</button>;
                                  })}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                                  {OPCIONES_RESERVA.map(opt => (
                                    <button key={String(opt.value)} type="button" style={{ ...S.chip(editFields.gratuita === opt.value), padding: "4px 10px", fontSize: "12px" }}
                                      onClick={() => setEditFields({ ...editFields, gratuita: opt.value })}>{opt.label}</button>
                                  ))}
                                  <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", cursor: "pointer", marginLeft: "6px", fontFamily: '"Patrick Hand", system-ui, cursive' }}>
                                    <input type="checkbox" checked={editFields.tieneLuz} onChange={e => setEditFields({ ...editFields, tieneLuz: e.target.checked })} />
                                    💡 Tiene luz
                                  </label>
                                </div>
                              </>
                            )}
                            <div style={S.ayuda}>Para cambiar la ubicación, busca la dirección o pega un link de Google Maps:</div>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <input
                                type="text"
                                style={{ ...S.input, flex: 1, fontSize: "13px", padding: "8px 12px" }}
                                placeholder='Dirección o link de Google Maps...'
                                value={editSearch}
                                onChange={e => setEditSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleEditSearch(); } }}
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
                            <button style={{ ...S.btnSmall, background: "#2e7d32", alignSelf: "flex-start" }} onClick={() => handleSaveCancha(c._id)}>
                              Guardar cambios{editCoords ? " y ubicación" : ""}
                            </button>
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
                            {u.suspendidoHasta && new Date(u.suspendidoHasta) > new Date() && (
                              <span style={S.badgeRed}>Suspendido hasta {formatDate(u.suspendidoHasta)}</span>
                            )}
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
                          {u.suspendidoHasta && new Date(u.suspendidoHasta) > new Date() ? (
                            <button style={S.btnGreen} onClick={() => updateUser(u._id, { levantarSuspension: true })}>Levantar suspensión</button>
                          ) : (
                            <button style={S.btnOutline} onClick={() => {
                              const dias = window.prompt("¿Cuántos días de suspensión? (conducta grave: 7 o 30)", "7");
                              if (dias && /^\d+$/.test(dias.trim())) updateUser(u._id, { suspenderDias: parseInt(dias) });
                            }}>Suspender</button>
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

        {/* ── APELACIONES DE STRIKES ── */}
        <div style={S.card}>
          <SectionHeader title="Apelaciones de strikes" badge={apelaciones?.length} isOpen={openSection === "apelaciones"} onClick={() => toggleSection("apelaciones")} />
          {openSection === "apelaciones" && (
            <div style={{ padding: "0 24px 24px" }}>
              {loadingApelaciones
                ? <div style={S.empty}>Cargando...</div>
                : !apelaciones?.length
                  ? <div style={S.empty}>No hay apelaciones pendientes</div>
                  : apelaciones.map(a => (
                    <div key={a._id} style={S.row}>
                      <div style={{ flex: 1 }}>
                        <div style={S.rowTitle}>
                          {[a.user?.nombre, a.user?.apellido].filter(Boolean).join(" ") || "Usuario"} · {{ inasistencia: "No llegó", cancelacion_tarde: "Salió tarde", conducta: "Conducta" }[a.tipo] || a.tipo}
                          {a.eventTitulo ? ` · "${a.eventTitulo}"` : ""}
                        </div>
                        <div style={S.rowSub}>
                          {formatDate(a.creadoAt)} · {a.user?.strikes || 0} strikes activos
                          {a.user?.suspendidoHasta && new Date(a.user.suspendidoHasta) > new Date() ? " · suspendido" : ""}
                        </div>
                        <div style={{ fontSize: "14px", marginTop: "6px", whiteSpace: "pre-wrap", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>“{a.apelacion?.texto}”</div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <button style={S.btnGreen} onClick={() => resolverApelacion(a._id, "aceptada")}>Quitar strike</button>
                        <button style={S.btnOutline} onClick={() => resolverApelacion(a._id, "rechazada")}>Mantener</button>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>

        {/* ── REPORTES ── */}
        <div style={S.card}>
          <SectionHeader
            title="Reportes"
            badge={reportsEstado === "pendiente" ? reports?.length : undefined}
            isOpen={openSection === "reportes"}
            onClick={() => toggleSection("reportes")}
          />
          {openSection === "reportes" && (
            <div style={{ padding: "0 24px 24px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                {[["pendiente", "Pendientes"], ["resuelto", "Resueltos"], ["descartado", "Descartados"]].map(([v, l]) => (
                  <button key={v} style={S.chip(reportsEstado === v)} onClick={() => loadReports(v)}>{l}</button>
                ))}
              </div>
              {loadingReports
                ? <div style={S.empty}>Cargando...</div>
                : (reports || []).length === 0
                  ? <div style={S.empty}>{reportsEstado === "pendiente" ? "No hay reportes pendientes" : "No hay reportes"}</div>
                  : reports.map(r => {
                    const persona = (u) => u ? [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email : "cuenta borrada";
                    return (
                      <div key={r._id} style={{ ...S.row, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: "220px" }}>
                          <div style={S.rowTitle}>
                            {r.tipo === "evento" ? "Evento" : "Usuario"}: {r.targetTitulo || "—"}
                          </div>
                          <div style={S.rowSub}>
                            {r.motivo} · por {persona(r.reporter)} · {formatDate(r.createdAt)}
                            {r.targetUser && <> · {r.tipo === "evento" ? "organiza" : "reportado"}: {persona(r.targetUser)} ({r.targetUser.strikes || 0} strikes{r.targetUser.activo === false ? ", suspendido" : ""})</>}
                          </div>
                          {r.detalle && <div style={{ fontSize: "13px", marginTop: "6px", color: "#333", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>“{r.detalle}”</div>}
                          {r.targetEvent && <a href={`/event/${r.targetEvent._id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px" }}>Ver evento</a>}
                        </div>
                        {reportsEstado === "pendiente" && (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {r.targetUser && <button style={S.btnDanger} onClick={() => resolverReporte(r._id, "resuelto", true)}>Sumar strike y resolver</button>}
                            <button style={S.btnGreen} onClick={() => resolverReporte(r._id, "resuelto")}>Resolver</button>
                            <button style={S.btnOutline} onClick={() => resolverReporte(r._id, "descartado")}>Descartar</button>
                          </div>
                        )}
                      </div>
                    );
                  })
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
  ayuda: { fontSize: "13px", color: "#666", marginTop: "6px", lineHeight: 1.4, fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' },
  msg: { padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px", fontWeight: 600, fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' },
  divider: { height: "1px", background: "#eee", margin: "0 0 0 0" },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" },
  rowTitle: { fontSize: "15px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', color: "#000" },
  rowSub: { fontSize: "12px", color: "#777", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginTop: "2px" },
  empty: { textAlign: "center", padding: "24px", color: "#999", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' },
  badgeBlue: { background: "#e3f2fd", color: "#1565c0", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' },
  badgeRed: { background: "#ffebee", color: "#c62828", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' },
  badgeYellow: { background: "#fff8e1", color: "#f57f17", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' },
  badgeGreen: { background: "#e8f5e9", color: "#2e7d32", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' },
  badgeGray: { background: "#f0f0f0", color: "#555", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif' }
};
