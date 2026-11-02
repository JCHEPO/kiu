import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Mismos motivos que backend/src/models/Report.js
const MOTIVOS = [
  { value: "acoso o insultos", label: "Acoso o insultos" },
  { value: "spam o publicidad", label: "Spam o publicidad" },
  { value: "contenido inapropiado", label: "Contenido inapropiado" },
  { value: "datos falsos", label: "Información falsa" },
  { value: "no se presentó", label: "No se presentó" },
  { value: "otro", label: "Otro" }
];

/**
 * Ventana para reportar un usuario o un evento.
 * tipo: "usuario" | "evento" · id: el id del usuario o del evento · nombre: para el título
 */
export default function ReportModal({ tipo, id, nombre, onClose }) {
  const { fetchWithAuth } = useContext(AuthContext);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");

  const enviar = async () => {
    if (!motivo) { setError("Elige un motivo"); return; }
    setError("");
    setEnviando(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id, motivo, detalle: detalle.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "No se pudo enviar el reporte"); return; }
      setListo(data.message || "Gracias. Revisaremos tu reporte.");
    } catch {
      setError("Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  const font = '"Bricolage Grotesque", system-ui, sans-serif';
  const boton = (primario) => ({
    padding: "9px 16px", borderRadius: "8px", border: "2px solid #000", cursor: "pointer", fontWeight: 700, fontFamily: font, fontSize: "14px",
    background: primario ? "#000" : "#fff", color: primario ? "#fff" : "#000"
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "16px" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="reporte-titulo"
        style={{ background: "#fff", border: "3px solid #000", borderRadius: "16px", boxShadow: "6px 6px 0 #000", padding: "24px", maxWidth: "420px", width: "100%", fontFamily: font }}
        onClick={(e) => e.stopPropagation()}
      >
        <div id="reporte-titulo" style={{ fontSize: "20px", fontWeight: 900, marginBottom: "6px" }}>
          Reportar {tipo === "evento" ? "evento" : "usuario"}
        </div>
        {nombre && <div style={{ fontSize: "14px", color: "#555", marginBottom: "14px" }}>{nombre}</div>}

        {listo ? (
          <>
            <div style={{ fontSize: "15px", lineHeight: 1.5, marginBottom: "16px" }}>{listo}</div>
            <button style={boton(true)} onClick={onClose}>Cerrar</button>
          </>
        ) : (
          <>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }} htmlFor="reporte-motivo">Motivo</label>
            <select
              id="reporte-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "2px solid #333", borderRadius: "8px", fontSize: "15px", marginBottom: "12px", fontFamily: font, background: "#fff" }}
            >
              <option value="" disabled>Elige un motivo</option>
              {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }} htmlFor="reporte-detalle">Cuéntanos qué pasó (opcional)</label>
            <textarea
              id="reporte-detalle"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value.slice(0, 500))}
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px", border: "2px solid #333", borderRadius: "8px", fontSize: "14px", fontFamily: font, resize: "vertical" }}
            />
            <div style={{ fontSize: "12px", color: "#777", textAlign: "right", marginBottom: "10px" }}>{detalle.length}/500</div>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>
              La persona reportada no sabe quién la reportó. Si hay un riesgo para alguien, llama al 133 (Carabineros).
            </div>
            {error && <div style={{ color: "#c62828", fontSize: "13px", marginBottom: "10px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button style={boton(false)} onClick={onClose} disabled={enviando}>Cancelar</button>
              <button style={boton(true)} onClick={enviar} disabled={enviando}>{enviando ? "Enviando..." : "Enviar reporte"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
