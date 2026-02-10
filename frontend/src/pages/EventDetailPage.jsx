import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function EventDetailPage() {
  const { id } = useParams();
  const { auth, fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [newItem, setNewItem] = useState("");
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Edit inline states
  const [editingLocation, setEditingLocation] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  // Manual participants
  const [newManualParticipant, setNewManualParticipant] = useState("");

  // Location popup after joining
  const [showLocationPopup, setShowLocationPopup] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    const socket = io(API_URL);
    socket.emit("join-event", id);
    socket.on("event-updated", (updatedEvent) => {
      setEvent(updatedEvent);
    });
    return () => {
      socket.emit("leave-event", id);
      socket.disconnect();
    };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!event?.date) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const eventTime = new Date(event.date).getTime();
      const distance = eventTime - now;

      if (distance < 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setCountdown({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event?.date]);

  const fetchEventDetails = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}`);
      if (!res.ok) throw new Error("Error al cargar evento");
      const data = await res.json();
      setEvent(data);
    } catch (error) {
      console.error("Error fetching event:", error);
      alert("Error al cargar evento");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinEvent = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/join`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Error al unirse");
      await fetchEventDetails();
      setShowLocationPopup(true);
    } catch (error) {
      console.error("Error joining event:", error);
      alert("Error al unirse al evento");
    }
  };

  const handleLeaveEvent = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/leave`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Error al salir");
      await fetchEventDetails();
    } catch (error) {
      console.error("Error leaving event:", error);
      alert("Error al salir del evento");
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm("¿Estás seguro de eliminar este evento?")) return;

    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Error al eliminar");
      alert("Evento eliminado");
      navigate("/");
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Error al eliminar evento");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newMessage })
      });
      if (!res.ok) throw new Error("Error al enviar mensaje");
      setNewMessage("");
      await fetchEventDetails();
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error al enviar mensaje");
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem })
      });
      if (!res.ok) throw new Error("Error al agregar item");
      setNewItem("");
      await fetchEventDetails();
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error al agregar item");
    }
  };

  const handleClaimItem = async (itemId) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/items/${itemId}/claim`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Error al reclamar item");
      await fetchEventDetails();
    } catch (error) {
      console.error("Error claiming item:", error);
      alert("Error al reclamar item");
    }
  };

  // Edición inline - Location
  const handleEditLocation = () => {
    setEditLocation(event.location || "");
    setEditingLocation(true);
  };

  const handleSaveLocation = async () => {
    if (!editLocation.trim()) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: editLocation.trim() })
      });
      if (!res.ok) throw new Error("Error al editar");
      setEditingLocation(false);
      await fetchEventDetails();
    } catch (error) {
      console.error("Error editing location:", error);
      alert("Error al editar lugar");
    }
  };

  // Edición inline - Date/Time
  const canEditDate = () => {
    if (!event?.date) return false;
    const now = new Date();
    const eventDate = new Date(event.date);
    return (eventDate - now) / (1000 * 60 * 60) >= 24;
  };

  const handleEditDate = () => {
    if (!canEditDate()) return;
    const d = new Date(event.date);
    const dateStr = d.toISOString().split("T")[0];
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    setEditDate(dateStr);
    setEditTime(timeStr);
    setEditingDate(true);
  };

  const handleSaveDate = async () => {
    if (!editDate || !editTime) return;
    try {
      const newDate = `${editDate}T${editTime}:00`;
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al editar fecha");
        return;
      }
      setEditingDate(false);
      await fetchEventDetails();
    } catch (error) {
      console.error("Error editing date:", error);
      alert("Error al editar fecha/hora");
    }
  };

  // Participantes manuales
  const handleAddManualParticipant = async (e) => {
    e.preventDefault();
    if (!newManualParticipant.trim()) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/manual-participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newManualParticipant.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al agregar participante");
        return;
      }
      setNewManualParticipant("");
      await fetchEventDetails();
    } catch (error) {
      console.error("Error adding manual participant:", error);
      alert("Error al agregar participante");
    }
  };

  const handleRemoveManualParticipant = async (index) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/events/${id}/manual-participants/${index}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Error al remover participante");
      await fetchEventDetails();
    } catch (error) {
      console.error("Error removing manual participant:", error);
      alert("Error al remover participante");
    }
  };

  const loadingStyles = {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundColor: "#e8e8e8"
    },
    text: {
      fontSize: "24px",
      fontWeight: 900,
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }
  };

  if (loading) {
    return (
      <div style={loadingStyles.container}>
        <div style={loadingStyles.text}>Cargando evento...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={loadingStyles.container}>
        <div style={loadingStyles.text}>Evento no encontrado</div>
      </div>
    );
  }

  const isCreator = event.creator._id === auth?.user?.id || event.creator === auth?.user?.id;
  const isParticipant = event.participants?.some(p =>
    (p._id === auth?.user?.id) || (p === auth?.user?.id)
  );
  const isFull = event.participants?.length >= event.maxParticipants;

  const getCardGradient = () => {
    if (event.category === "Partido") {
      return "linear-gradient(90deg, #A9FF68, #FF8989)";
    }
    if (event.category === "Evento") {
      return "linear-gradient(90deg, #145277, #83D0CB)";
    }
    if (event.category === "Social") {
      return "linear-gradient(90deg, #84FFC9, #AAB2FF, #ECA0FF)";
    }
    return "linear-gradient(90deg, #e0e0e0, #f5f5f5)";
  };

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

  const getTitleParts = () => {
    if (event.category === "Partido") {
      const sport = event.title.replace("Partido de ", "");
      return {
        line1: "Partido de",
        line2: sport,
        line3: event.subcategory || ""
      };
    }

    if (event.category === "Social" || event.category === "Evento") {
      return {
        line1: event.title,
        line2: "",
        line3: event.subcategory ? `${event.subcategory} personas` : ""
      };
    }

    return { line1: event.title, line2: "", line3: "" };
  };

  const titleParts = getTitleParts();
  const currentParticipants = (event.participants?.length || 0) + (event.manualParticipants?.length || 0);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  const styles = {
    wrapper: {
      padding: isMobile ? "12px" : "40px",
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      backgroundColor: "#e8e8e8",
      minHeight: "100vh"
    },
    container: {
      maxWidth: "1200px",
      margin: "0 auto"
    },
    backButton: {
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
    eventCard: {
      background: getCardGradient(),
      borderRadius: isMobile ? "14px" : "20px",
      padding: isMobile ? "20px" : "40px",
      marginBottom: isMobile ? "16px" : "30px",
      border: "3px solid #333",
      position: "relative"
    },
    rating: {
      position: "absolute",
      top: isMobile ? "16px" : "30px",
      right: isMobile ? "16px" : "30px",
      fontSize: isMobile ? "22px" : "32px",
      fontWeight: "bold",
      color: "#000"
    },
    titleContainer: {
      marginBottom: isMobile ? "16px" : "30px"
    },
    titleLine1: {
      fontSize: isMobile ? "20px" : "28px",
      fontWeight: 900,
      color: "#000",
      lineHeight: 1,
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    titleLine2: {
      fontSize: isMobile ? "32px" : "48px",
      fontWeight: 900,
      color: "#000",
      lineHeight: 1,
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    titleLine3: {
      fontSize: isMobile ? "18px" : "24px",
      fontWeight: 700,
      color: "#000",
      lineHeight: 1,
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    eventInfo: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: isMobile ? "16px" : "30px",
      fontSize: isMobile ? "14px" : "18px",
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    actionsContainer: {
      display: "flex",
      gap: isMobile ? "10px" : "15px",
      marginBottom: isMobile ? "16px" : "30px",
      flexWrap: "wrap"
    },
    actionButton: {
      background: "#fff",
      border: "3px solid #000",
      padding: isMobile ? "10px 18px" : "15px 30px",
      fontSize: isMobile ? "14px" : "18px",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "3px 3px 0 #000",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      textTransform: "uppercase",
      transition: "all 0.2s",
      flex: isMobile ? "1" : undefined
    },
    deleteButton: {
      background: "#ff6b6b",
      color: "#fff"
    },
    disabledButton: {
      opacity: 0.5,
      cursor: "not-allowed"
    },
    // Desktop: 2 columns (countdown small | muro big)
    // Mobile: single column, reordered via separate render
    gridContainer: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr",
      gap: isMobile ? "12px" : "30px",
      marginBottom: isMobile ? "12px" : "30px"
    },
    // Mobile bottom row: countdown + participants side by side, compact
    gridContainerCompact: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
      marginBottom: "12px"
    },
    section: {
      background: "rgba(255, 255, 255, 0.8)",
      borderRadius: isMobile ? "12px" : "15px",
      padding: isMobile ? "16px" : "30px",
      border: "3px solid #333"
    },
    sectionCompact: {
      background: "rgba(255, 255, 255, 0.8)",
      borderRadius: "12px",
      padding: "12px",
      border: "2px solid #333"
    },
    sectionTitle: {
      fontSize: isMobile ? "18px" : "24px",
      fontWeight: 900,
      marginBottom: isMobile ? "12px" : "20px",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      textTransform: "uppercase"
    },
    sectionTitleCompact: {
      fontSize: "13px",
      fontWeight: 900,
      marginBottom: "8px",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      textTransform: "uppercase"
    },
    countdown: {
      display: "flex",
      gap: isMobile ? "12px" : "20px",
      justifyContent: "center",
      marginTop: isMobile ? "0" : "20px"
    },
    countdownItem: {
      textAlign: "center"
    },
    countdownNumber: {
      fontSize: isMobile ? "22px" : "48px",
      fontWeight: 900,
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      lineHeight: 1
    },
    countdownLabel: {
      fontSize: isMobile ? "10px" : "14px",
      fontWeight: "bold",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      textTransform: "uppercase"
    },
    chatWall: {
      maxHeight: isMobile ? "300px" : "400px",
      overflowY: "auto",
      marginBottom: isMobile ? "12px" : "20px"
    },
    message: {
      background: "#fff",
      border: "2px solid #333",
      borderRadius: "10px",
      padding: isMobile ? "10px" : "15px",
      marginBottom: isMobile ? "8px" : "10px"
    },
    messageSender: {
      fontWeight: "bold",
      fontSize: isMobile ? "13px" : "14px",
      marginBottom: "5px",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    messageText: {
      fontSize: isMobile ? "14px" : "16px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    messageForm: {
      display: "flex",
      gap: isMobile ? "8px" : "10px"
    },
    input: {
      flex: 1,
      border: "3px solid #000",
      padding: isMobile ? "10px" : "12px",
      fontSize: isMobile ? "14px" : "16px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      borderRadius: "5px"
    },
    sendButton: {
      background: "#fff",
      border: "3px solid #000",
      padding: isMobile ? "10px 14px" : "12px 20px",
      fontSize: isMobile ? "14px" : "16px",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "3px 3px 0 #000",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    itemsList: {
      marginBottom: isMobile ? "12px" : "20px"
    },
    item: {
      background: "#fff",
      border: "2px solid #333",
      borderRadius: "10px",
      padding: isMobile ? "10px 12px" : "15px",
      marginBottom: isMobile ? "8px" : "10px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    itemClaimed: {
      background: "#d4f4dd",
      borderColor: "#4caf50"
    },
    itemName: {
      fontSize: isMobile ? "14px" : "16px",
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    itemClaimer: {
      fontSize: isMobile ? "12px" : "14px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      color: "#666"
    },
    claimButton: {
      background: "#fff",
      border: "2px solid #000",
      padding: isMobile ? "6px 10px" : "8px 15px",
      fontSize: isMobile ? "12px" : "14px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      boxShadow: "2px 2px 0 #000"
    },
    participantRow: {
      display: "flex",
      alignItems: "center",
      gap: isMobile ? "6px" : "10px",
      padding: isMobile ? "8px 10px" : "12px 15px",
      background: "#fff",
      border: "2px solid #333",
      borderRadius: "10px",
      marginBottom: isMobile ? "6px" : "8px"
    },
    participantName: {
      fontSize: isMobile ? "13px" : "16px",
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      color: "#000"
    },
    creatorTag: {
      display: "inline-block",
      background: "#000",
      color: "#fff",
      padding: "2px 10px",
      borderRadius: "20px",
      fontSize: isMobile ? "9px" : "11px",
      fontWeight: "bold",
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      textTransform: "uppercase",
      letterSpacing: "0.5px"
    },
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <button style={styles.backButton} onClick={() => navigate("/")}>
          ← Volver
        </button>

        {/* Event Card */}
        <div style={styles.eventCard}>
          <div style={styles.rating}>{currentParticipants}/{event.maxParticipants}</div>

          <div style={styles.titleContainer}>
            {titleParts.line1 && <div style={styles.titleLine1}>{titleParts.line1}</div>}
            {titleParts.line2 && <div style={styles.titleLine2}>{titleParts.line2}</div>}
            {titleParts.line3 && <div style={styles.titleLine3}>{titleParts.line3}</div>}
          </div>

          <div style={styles.eventInfo}>
            <div>
              {editingLocation ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    style={{ border: "2px solid #000", padding: "4px 8px", fontSize: isMobile ? "13px" : "16px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', borderRadius: "4px", width: "160px" }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveLocation(); if (e.key === "Escape") setEditingLocation(false); }}
                  />
                  <span style={{ cursor: "pointer", fontSize: "16px" }} onClick={handleSaveLocation}>&#10003;</span>
                  <span style={{ cursor: "pointer", fontSize: "16px" }} onClick={() => setEditingLocation(false)}>&#10005;</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {event.location}
                  {isCreator && (
                    <span style={{ cursor: "pointer", fontSize: "14px", opacity: 0.7 }} onClick={handleEditLocation} title="Editar lugar">&#9998;</span>
                  )}
                </div>
              )}
              <div>{event.cost ? `$${event.cost} por persona` : "Gratis"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {editingDate ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    style={{ border: "2px solid #000", padding: "4px 6px", fontSize: "13px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', borderRadius: "4px" }}
                  />
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    style={{ border: "2px solid #000", padding: "4px 6px", fontSize: "13px", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', borderRadius: "4px" }}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ cursor: "pointer", fontSize: "16px" }} onClick={handleSaveDate}>&#10003;</span>
                    <span style={{ cursor: "pointer", fontSize: "16px" }} onClick={() => setEditingDate(false)}>&#10005;</span>
                  </div>
                </div>
              ) : (
                event.date && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {formatDate(event.date)}
                      {isCreator && (
                        <span
                          style={{ cursor: canEditDate() ? "pointer" : "not-allowed", fontSize: "14px", opacity: canEditDate() ? 0.7 : 0.3 }}
                          onClick={handleEditDate}
                          title={canEditDate() ? "Editar fecha/hora" : "No se puede editar a menos de 24h del evento"}
                        >&#9998;</span>
                      )}
                    </div>
                    <div>{formatTime(event.date)} horas</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionsContainer}>
          {isCreator ? (
            <>
              <button style={{...styles.actionButton, ...styles.deleteButton}} onClick={handleDeleteEvent}>
                Eliminar Evento
              </button>
            </>
          ) : (
            <>
              {isParticipant ? (
                <button style={styles.actionButton} onClick={handleLeaveEvent}>
                  Salir del Evento
                </button>
              ) : (
                <button
                  style={{...styles.actionButton, ...(isFull && styles.disabledButton)}}
                  onClick={handleJoinEvent}
                  disabled={isFull}
                >
                  {isFull ? "Evento Lleno" : "Unirse al Evento"}
                </button>
              )}
            </>
          )}
          <button
            style={styles.actionButton}
            onClick={async () => {
              const url = window.location.href;
              const fecha = event.date ? `${formatDate(event.date)} a las ${formatTime(event.date)}` : "";
              const texto = [
                event.title,
                fecha,
                event.location,
                event.cost ? `$${event.cost}` : "Gratis",
                event.description
              ].filter(Boolean).join("\n");

              if (navigator.share) {
                try {
                  await navigator.share({ title: event.title, text: texto, url });
                } catch (e) {
                  // user cancelled share
                }
              } else {
                navigator.clipboard.writeText(`${texto}\n${url}`);
                alert("Link copiado al portapapeles");
              }
            }}
          >
            Compartir
          </button>
        </div>

        {isMobile ? (
          <>
            {/* MOBILE BENTO: Que Llevamos first */}
            <div style={{ marginBottom: "12px" }}>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Que Llevamos?</h3>
                <div style={styles.itemsList}>
                  {event.items && event.items.length > 0 ? (
                    event.items.map((item) => (
                      <div
                        key={item._id}
                        style={{...styles.item, ...(item.claimedBy && styles.itemClaimed)}}
                      >
                        <div>
                          <div style={styles.itemName}>{item.name}</div>
                          {item.claimedBy && (
                            <div style={styles.itemClaimer}>
                              {item.claimedBy.name || "Alguien"} lo lleva
                            </div>
                          )}
                        </div>
                        {!item.claimedBy && (isCreator || isParticipant) && (
                          <button style={styles.claimButton} onClick={() => handleClaimItem(item._id)}>
                            Yo llevo
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                      {isCreator ? "Agrega items que se necesiten" : "No hay items aun"}
                    </div>
                  )}
                </div>
                {isCreator && (
                  <form style={styles.messageForm} onSubmit={handleAddItem}>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="Agregar item necesario..."
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                    />
                    <button type="submit" style={styles.sendButton}>Agregar</button>
                  </form>
                )}
              </div>
            </div>

            {/* MOBILE BENTO: Muro second */}
            <div style={{ marginBottom: "12px" }}>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Muro</h3>
                <div style={styles.chatWall}>
                  {event.messages && event.messages.length > 0 ? (
                    event.messages.map((msg, idx) => (
                      <div key={idx} style={styles.message}>
                        <div style={styles.messageSender}>{msg.sender?.name || "Anónimo"}</div>
                        <div style={styles.messageText}>{msg.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                      No hay mensajes aún
                    </div>
                  )}
                </div>
                <form style={styles.messageForm} onSubmit={handleSendMessage}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" style={styles.sendButton}>Enviar</button>
                </form>
              </div>
            </div>

            {/* MOBILE BENTO: Countdown + Participants compact side-by-side */}
            <div style={styles.gridContainerCompact}>
              <div style={styles.sectionCompact}>
                <h3 style={styles.sectionTitleCompact}>Cuenta Regresiva</h3>
                <div style={styles.countdown}>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.days}</div>
                    <div style={styles.countdownLabel}>D</div>
                  </div>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.hours}</div>
                    <div style={styles.countdownLabel}>H</div>
                  </div>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.minutes}</div>
                    <div style={styles.countdownLabel}>M</div>
                  </div>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.seconds}</div>
                    <div style={styles.countdownLabel}>S</div>
                  </div>
                </div>
              </div>

              <div style={styles.sectionCompact}>
                <h3 style={styles.sectionTitleCompact}>Participantes</h3>
                {event.creator && (
                  <div style={styles.participantRow}>
                    <div style={styles.participantName}>
                      {event.creator.nombre || event.creator.email?.split("@")[0] || "Organizador"}
                    </div>
                    <span style={styles.creatorTag}>Creador</span>
                  </div>
                )}
                {event.participants?.filter(p => p._id !== event.creator?._id && p._id !== event.creator).map((p) => (
                  <div key={p._id} style={styles.participantRow}>
                    <div style={styles.participantName}>
                      {p.nombre || p.email?.split("@")[0] || "Participante"}
                    </div>
                  </div>
                ))}
                {event.manualParticipants?.map((name, idx) => (
                  <div key={`manual-${idx}`} style={styles.participantRow}>
                    <div style={styles.participantName}>{name}</div>
                    <span style={{ ...styles.creatorTag, background: "#666" }}>Manual</span>
                    {isCreator && (
                      <span style={{ cursor: "pointer", fontSize: "12px", marginLeft: "auto", color: "#cc0000" }} onClick={() => handleRemoveManualParticipant(idx)}>&#10005;</span>
                    )}
                  </div>
                ))}
                {(!event.participants || event.participants.filter(p => p._id !== event.creator?._id).length === 0) && (!event.manualParticipants || event.manualParticipants.length === 0) && (
                  <div style={{ textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', fontSize: "12px", marginTop: "6px" }}>
                    Sin participantes aun
                  </div>
                )}
                {isCreator && (
                  <form style={{ display: "flex", gap: "4px", marginTop: "6px" }} onSubmit={handleAddManualParticipant}>
                    <input
                      type="text"
                      placeholder="Nombre..."
                      value={newManualParticipant}
                      onChange={(e) => setNewManualParticipant(e.target.value)}
                      style={{ flex: 1, border: "2px solid #000", padding: "4px 6px", fontSize: "11px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', borderRadius: "4px" }}
                    />
                    <button type="submit" style={{ background: "#fff", border: "2px solid #000", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>+</button>
                  </form>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* DESKTOP: Countdown + Que Llevamos */}
            <div style={styles.gridContainer}>
              {/* Countdown */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Cuenta Regresiva</h3>
                <div style={styles.countdown}>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.days}</div>
                    <div style={styles.countdownLabel}>Días</div>
                  </div>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.hours}</div>
                    <div style={styles.countdownLabel}>Horas</div>
                  </div>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.minutes}</div>
                    <div style={styles.countdownLabel}>Min</div>
                  </div>
                  <div style={styles.countdownItem}>
                    <div style={styles.countdownNumber}>{countdown.seconds}</div>
                    <div style={styles.countdownLabel}>Seg</div>
                  </div>
                </div>
              </div>

              {/* What We're Bringing */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Que Llevamos?</h3>
                <div style={styles.itemsList}>
                  {event.items && event.items.length > 0 ? (
                    event.items.map((item) => (
                      <div
                        key={item._id}
                        style={{...styles.item, ...(item.claimedBy && styles.itemClaimed)}}
                      >
                        <div>
                          <div style={styles.itemName}>{item.name}</div>
                          {item.claimedBy && (
                            <div style={styles.itemClaimer}>
                              {item.claimedBy.name || "Alguien"} lo lleva
                            </div>
                          )}
                        </div>
                        {!item.claimedBy && (isCreator || isParticipant) && (
                          <button style={styles.claimButton} onClick={() => handleClaimItem(item._id)}>
                            Yo llevo
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                      {isCreator ? "Agrega items que se necesiten" : "No hay items aun"}
                    </div>
                  )}
                </div>
                {isCreator && (
                  <form style={styles.messageForm} onSubmit={handleAddItem}>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="Agregar item necesario..."
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                    />
                    <button type="submit" style={styles.sendButton}>Agregar</button>
                  </form>
                )}
              </div>
            </div>

            {/* DESKTOP: Participants + Muro grid */}
            <div style={styles.gridContainer}>
              {/* Participantes */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Participantes</h3>
                {event.creator && (
                  <div style={styles.participantRow}>
                    <div style={styles.participantName}>
                      {event.creator.nombre || event.creator.email?.split("@")[0] || "Organizador"}
                    </div>
                    <span style={styles.creatorTag}>Creador</span>
                  </div>
                )}
                {event.participants?.filter(p => p._id !== event.creator?._id && p._id !== event.creator).map((p) => (
                  <div key={p._id} style={styles.participantRow}>
                    <div style={styles.participantName}>
                      {p.nombre || p.email?.split("@")[0] || "Participante"}
                    </div>
                  </div>
                ))}
                {event.manualParticipants?.map((name, idx) => (
                  <div key={`manual-${idx}`} style={styles.participantRow}>
                    <div style={styles.participantName}>{name}</div>
                    <span style={{ ...styles.creatorTag, background: "#666" }}>Manual</span>
                    {isCreator && (
                      <span style={{ cursor: "pointer", fontSize: "14px", marginLeft: "auto", color: "#cc0000" }} onClick={() => handleRemoveManualParticipant(idx)}>&#10005;</span>
                    )}
                  </div>
                ))}
                {(!event.participants || event.participants.filter(p => p._id !== event.creator?._id).length === 0) && (!event.manualParticipants || event.manualParticipants.length === 0) && (
                  <div style={{ textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', marginTop: "10px" }}>
                    Aun no hay mas participantes
                  </div>
                )}
                {isCreator && (
                  <form style={{ display: "flex", gap: "8px", marginTop: "10px" }} onSubmit={handleAddManualParticipant}>
                    <input
                      type="text"
                      placeholder="Agregar participante..."
                      value={newManualParticipant}
                      onChange={(e) => setNewManualParticipant(e.target.value)}
                      style={{ flex: 1, border: "3px solid #000", padding: "10px", fontSize: "14px", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive', borderRadius: "5px" }}
                    />
                    <button type="submit" style={{ background: "#fff", border: "3px solid #000", padding: "10px 16px", fontSize: "14px", fontWeight: "bold", cursor: "pointer", boxShadow: "2px 2px 0 #000", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>Agregar</button>
                  </form>
                )}
              </div>

              {/* Chat Wall */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Muro</h3>
                <div style={styles.chatWall}>
                  {event.messages && event.messages.length > 0 ? (
                    event.messages.map((msg, idx) => (
                      <div key={idx} style={styles.message}>
                        <div style={styles.messageSender}>{msg.sender?.name || "Anónimo"}</div>
                        <div style={styles.messageText}>{msg.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", color: "#666", fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive' }}>
                      No hay mensajes aún
                    </div>
                  )}
                </div>
                <form style={styles.messageForm} onSubmit={handleSendMessage}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" style={styles.sendButton}>Enviar</button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Location popup after joining */}
      {showLocationPopup && event?.location && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 9999
          }}
          onClick={() => setShowLocationPopup(false)}
        >
          <div
            style={{
              background: "#fff", border: "3px solid #000", borderRadius: "16px",
              padding: isMobile ? "24px 20px" : "32px 36px", maxWidth: "400px",
              width: "90%", boxShadow: "6px 6px 0 #000", textAlign: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>&#127881;</div>
            <div style={{
              fontSize: isMobile ? "18px" : "22px", fontWeight: 900,
              fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
              marginBottom: "8px"
            }}>
              Te uniste al evento!
            </div>
            <div style={{
              fontSize: isMobile ? "14px" : "16px", color: "#666",
              fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
              marginBottom: "20px"
            }}>
              El evento es en:
            </div>
            <div style={{
              fontSize: isMobile ? "18px" : "20px", fontWeight: "bold",
              fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
              marginBottom: "20px"
            }}>
              {event.location}
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", background: "#000", color: "#fff",
                border: "none", borderRadius: "10px", padding: "14px 24px",
                fontSize: isMobile ? "15px" : "17px", fontWeight: "bold",
                fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
                textDecoration: "none", cursor: "pointer", marginBottom: "12px"
              }}
            >
              Abrir en Maps
            </a>
            <button
              onClick={() => setShowLocationPopup(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "14px", color: "#999",
                fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
