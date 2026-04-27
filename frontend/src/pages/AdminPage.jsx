import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function AdminPage() {
  const { auth, fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [canchas, setCanchas] = useState([]);
  const [formData, setFormData] = useState({
    categoria: "cancha",
    nombre: "",
    latitud: "",
    longitud: "",
    comuna: "",
    direccion: "",
    tipo: [],
    gratuita: true
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

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

  useEffect(() => {
    fetchCanchas();
  }, []);

  const fetchCanchas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/canchas`);
      const data = await res.json();
      setCanchas(data);
    } catch (err) {
      console.error("Error fetching canchas:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          ubicacion: {
            type: "Point",
            coordinates: [parseFloat(formData.longitud), parseFloat(formData.latitud)]
          },
          comuna: formData.comuna,
          direccion: formData.direccion,
          tipo: formData.categoria === "cancha" ? formData.tipo : [],
          categoria: formData.categoria,
          gratuita: formData.gratuita
        })
      });

      if (res.ok) {
        setMessage("Lugar agregado exitosamente");
        setFormData({ categoria: formData.categoria, nombre: "", latitud: "", longitud: "", comuna: "", direccion: "", tipo: [], gratuita: true });
        fetchCanchas();
      } else {
        const data = await res.json();
        setMessage(data.error || "Error al crear cancha");
      }
    } catch (err) {
      setMessage("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  const detectComuna = (text) => {
    const lower = text.toLowerCase();
    return comunaOptions.find(c => lower.includes(c.toLowerCase())) || "";
  };

  const parseGoogleMapsUrl = (url) => {
    // Extract place name from /place/Name+Here/
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    const placeName = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, " ")) : "";
    // Format: /@-36.827,-73.049,17z or @-36.827,-73.049
    let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), name: placeName };
    // Format: ?q=-36.827,-73.049 or !3d-36.827!4d-73.049
    match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), name: placeName };
    match = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), name: placeName };
    return null;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setMessage("");
    const q = searchQuery.trim();

    try {
      // Try parsing as Google Maps URL first
      let mapsUrl = q;
      const isGoogleLink = q.includes("google.com/maps") || q.includes("maps.app.goo.gl") || q.includes("goo.gl/maps");

      if (isGoogleLink) {
        // Resolve short URLs via backend
        if (q.includes("goo.gl") || q.includes("maps.app")) {
          const resolveRes = await fetch(`${API_URL}/api/canchas/resolve-url?url=${encodeURIComponent(q)}`);
          const resolveData = await resolveRes.json();
          if (resolveData.url) mapsUrl = resolveData.url;
        }

        const coords = parseGoogleMapsUrl(mapsUrl);
        if (coords) {
          // Reverse geocode to get address
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&accept-language=es`);
          const data = await res.json();
          const addr = data.address || {};
          const road = [addr.road, addr.house_number].filter(Boolean).join(" ");
          setFormData(prev => ({
            ...prev,
            nombre: coords.name || prev.nombre,
            latitud: String(coords.lat),
            longitud: String(coords.lng),
            direccion: road || data.display_name?.split(",").slice(0, 2).join(",") || prev.direccion,
            comuna: detectComuna(data.display_name || "") || prev.comuna
          }));
          setMessage("Ubicacion encontrada desde link de Google Maps");
          setSearching(false);
          return;
        }
      }

      // Otherwise geocode as address / plus code
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=es&countrycodes=cl`);
      const data = await res.json();

      if (data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        // Reverse geocode to get detailed address
        const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`);
        const revData = await revRes.json();
        const addr = revData.address || {};
        const road = [addr.road, addr.house_number].filter(Boolean).join(" ");
        const nombre = revData.name || result.name || "";
        setFormData(prev => ({
          ...prev,
          nombre: nombre || prev.nombre,
          latitud: String(lat),
          longitud: String(lng),
          direccion: road || result.display_name?.split(",").slice(0, 2).join(",") || prev.direccion,
          comuna: detectComuna(revData.display_name || result.display_name || "") || prev.comuna
        }));
        setMessage("Ubicacion encontrada");
      } else {
        setMessage("No se encontro la ubicacion. Intenta con otra direccion o pega un link de Google Maps.");
      }
    } catch (err) {
      console.error("Geocode error:", err);
      setMessage("Error buscando ubicacion");
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/canchas/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCanchas(prev => prev.filter(c => c._id !== id));
      }
    } catch (err) {
      console.error("Error deleting cancha:", err);
    }
  };

  // Solo admins
  if (!auth || auth.user?.rol !== "admin") {
    return (
      <div style={styles.wrapper}>
        <div style={{ textAlign: "center", padding: "100px 40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <div style={{ fontSize: "24px", fontWeight: 900, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', marginBottom: "12px" }}>
            Acceso restringido
          </div>
          <div style={{ fontSize: "16px", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginBottom: "24px" }}>
            No tienes permisos para ver esta pagina
          </div>
          <button onClick={() => navigate("/")} style={styles.btnBack}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <span style={styles.logo}>Kiu</span>
        </button>
        <span style={{ fontSize: "18px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
          Panel Admin
        </span>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: isMobile ? "20px 16px" : "40px" }}>
        <h1 style={styles.pageTitle}>Administracion</h1>

        {/* Form: Agregar Cancha */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Agregar lugar</h2>

          {message && (
            <div style={{
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              background: message.includes("exitosamente") ? "#e8f5e9" : "#ffebee",
              color: message.includes("exitosamente") ? "#2e7d32" : "#c62828",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
            }}>
              {message}
            </div>
          )}

          <div style={{ ...styles.formGroup, marginBottom: "24px" }}>
            <label style={styles.label}>Buscar ubicacion (link de Google Maps, direccion o plus code)</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                style={{ ...styles.input, flex: 1 }}
                placeholder='Ej: "Av. Los Presidentes 1549, Concepción" o link de Google Maps'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                style={{
                  padding: "12px 20px",
                  background: "#000",
                  color: "#fff",
                  border: "2px solid #000",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                  cursor: searching ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: searching ? 0.6 : 1
                }}
              >
                {searching ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>

          <div style={{ height: "1px", background: "#ddd", margin: "0 0 20px 0" }} />

          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tipo de lugar</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {categoriaOptions.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, categoria: cat.value, tipo: [] })}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: formData.categoria === cat.value ? "2px solid #000" : "2px solid #ccc",
                      background: formData.categoria === cat.value ? "#000" : "#fff",
                      color: formData.categoria === cat.value ? "#fff" : "#000",
                      fontSize: "14px",
                      fontWeight: 600,
                      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                      cursor: "pointer"
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{formData.categoria === "cancha" ? "Nombre de la cancha" : `Nombre del ${formData.categoria}`}</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Ej: Cancha Parque Ecuador"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Latitud</label>
                <input
                  type="number"
                  step="any"
                  style={styles.input}
                  placeholder="-36.8270"
                  value={formData.latitud}
                  onChange={(e) => setFormData({ ...formData, latitud: e.target.value })}
                  required
                />
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Longitud</label>
                <input
                  type="number"
                  step="any"
                  style={styles.input}
                  placeholder="-73.0498"
                  value={formData.longitud}
                  onChange={(e) => setFormData({ ...formData, longitud: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Comuna</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {comunaOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, comuna: c })}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: formData.comuna === c ? "2px solid #000" : "2px solid #ccc",
                      background: formData.comuna === c ? "#000" : "#fff",
                      color: formData.comuna === c ? "#fff" : "#000",
                      fontSize: "14px",
                      fontWeight: 600,
                      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                      cursor: "pointer"
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Direccion</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Ej: Av. Los Carrera 1234"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              />
            </div>

            {formData.categoria === "cancha" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Acceso</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[{ value: true, label: "Gratuita" }, { value: false, label: "Pagada" }].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setFormData({ ...formData, gratuita: opt.value })}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: formData.gratuita === opt.value ? "2px solid #000" : "2px solid #ccc",
                        background: formData.gratuita === opt.value ? "#000" : "#fff",
                        color: formData.gratuita === opt.value ? "#fff" : "#000",
                        fontSize: "14px",
                        fontWeight: 600,
                        fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                        cursor: "pointer"
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.categoria === "cancha" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Tipo de deporte</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {tipoOptions.map((t) => {
                    const selected = formData.tipo.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (t === "multiuso") {
                            setFormData({ ...formData, tipo: selected ? [] : ["multiuso"] });
                          } else {
                            const without = formData.tipo.filter(x => x !== "multiuso");
                            setFormData({
                              ...formData,
                              tipo: selected ? without.filter(x => x !== t) : [...without, t]
                            });
                          }
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "20px",
                          border: selected ? "2px solid #000" : "2px solid #ccc",
                          background: selected ? "#000" : "#fff",
                          color: selected ? "#fff" : "#000",
                          fontSize: "14px",
                          fontWeight: 600,
                          fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                          cursor: "pointer",
                          textTransform: "capitalize"
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? "Guardando..." : `Agregar ${formData.categoria === "cancha" ? "Cancha" : formData.categoria}`}
            </button>
          </form>
        </div>

        {/* Lista de canchas existentes */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Lugares registrados ({canchas.length})</h2>
          {canchas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
              No hay lugares registrados
            </div>
          ) : (
            canchas.map((cancha) => (
              <div key={cancha._id} style={styles.canchaItem}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
                    {cancha.nombre}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginTop: "4px" }}>
                    [{cancha.categoria || "cancha"}] {cancha.comuna} {cancha.direccion ? `- ${cancha.direccion}` : ""}{cancha.tipo?.length ? ` | ${cancha.tipo.join(", ")}` : ""}{cancha.categoria === "cancha" ? ` | ${cancha.gratuita === false ? "Pagada" : "Gratuita"}` : ""}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginTop: "2px" }}>
                    {cancha.ubicacion?.coordinates?.[1]?.toFixed(4)}, {cancha.ubicacion?.coordinates?.[0]?.toFixed(4)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(cancha._id)}
                  style={styles.deleteBtn}
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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
  pageTitle: {
    fontSize: "36px",
    fontWeight: 900,
    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
    color: "#000",
    marginBottom: "30px"
  },
  card: {
    background: "rgba(255, 255, 255, 0.85)",
    borderRadius: "16px",
    border: "3px solid #333",
    padding: "30px",
    marginBottom: "24px"
  },
  cardTitle: {
    fontSize: "22px",
    fontWeight: 900,
    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
    marginBottom: "20px",
    color: "#000"
  },
  formGroup: {
    marginBottom: "16px"
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "bold",
    marginBottom: "6px",
    fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
    color: "#333"
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "2px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
    fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
    outline: "none",
    boxSizing: "border-box"
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#000",
    color: "#fff",
    border: "3px solid #000",
    borderRadius: "0px",
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
    boxShadow: "3px 3px 0 #333",
    textTransform: "uppercase",
    marginTop: "8px"
  },
  canchaItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 0",
    borderBottom: "1px solid #eee"
  },
  deleteBtn: {
    padding: "8px 16px",
    background: "#fff",
    color: "#ff4444",
    border: "2px solid #ff4444",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 700,
    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
    cursor: "pointer"
  },
  btnBack: {
    padding: "14px 30px",
    background: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif'
  }
};
