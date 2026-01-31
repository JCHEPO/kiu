import React, { useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function CreateEventPage() {
  const { fetchWithAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  // Mapa de opciones de personas por deporte
  const personasOptions = {
    Futbol: ["5vs5", "7vs7", "11vs11"],
    Voleyball: ["2vs2", "4vs4", "6vs6"],
    Handball: ["5vs5"],
    Tenis: ["1vs1", "2vs2"],
    Padel: ["1vs1", "2vs2"],
    Basket: ["1vs1", "2vs2", "5vs5"]
  };

  // Opciones para Juegos de mesa
  const socialOptions = ["Cartas", "Monopoly", "Puzzle", "Catan", "Otro"];
  const cartasOptions = ["Pokemon", "Magic", "Carioca", "Uno", "Otro"];

  // Estado equivalente a tu script JS
  const [eventData, setEventData] = useState({
    tipo: "",
    deporte: "",
    personas: "",
    customCount: "", // Para contador personalizado
    cartasTipo: "", // Sub-tipo de cartas: Pokemon, Magic, Carioca, Uno, Otro
    restriccionGenero: "", // "Solo hombres", "Solo mujeres", "Mixto"
    lugar: "",
    lugarOption: "",
    dateOption: "", // "hoy", "mañana", "otra"
    rawDate: "", // yyyy-mm-dd (input type="date")
    displayDate: "02 de Febrero",
    hora: "18:00", // HH:mm
    costoLabel: "Gratis",
    costoNumber: 0,
    gratis: true
  });
  const [step, setStep] = useState(1);

  const dateInputRef = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  // Helpers derivados
  const titleText = (() => {
    if (!eventData.tipo) return "¿Qué hacemos?";

    if (eventData.tipo === "Partido de futbol") {
      if (!eventData.deporte) return eventData.tipo;
      return `Partido de ${eventData.deporte}`;
    }

    if (eventData.tipo === "Juegos de mesa") {
      if (!eventData.deporte) return "Juegos de mesa";
      if (eventData.deporte === "Cartas" && eventData.cartasTipo) {
        return `Cartas ${eventData.cartasTipo}`;
      }
      return eventData.deporte;
    }

    // For "Evento", just show tipo
    return eventData.tipo;
  })();

  // Texto de personas para mostrar en línea separada
  const personasText = (() => {
    if (eventData.customCount) {
      return `${eventData.customCount} personas`;
    }
    return eventData.personas || "";
  })();

  // Calcular maxParticipants basado en el formato
  const maxParticipants = (() => {
    // Si hay un contador personalizado, usarlo
    if (eventData.customCount && parseInt(eventData.customCount) > 0) {
      return parseInt(eventData.customCount);
    }

    if (!eventData.personas) return 10;

    // Extraer números del formato (ej: "5vs5" -> [5, 5])
    const match = eventData.personas.match(/(\d+)vs(\d+)/);
    if (match) {
      const num1 = parseInt(match[1]);
      const num2 = parseInt(match[2]);
      return num1 + num2;
    }

    return 10; // fallback
  })();

  // Calcular saturación basada en el progreso (más granular)
  const getSaturation = () => {
    const minSaturation = 0.2;
    const maxSaturation = 1;

    // Contar cuántos campos están completos para tener progreso más granular
    let completedFields = 0;
    let totalFields = 7; // tipo, deporte/juego, personas, restriccionGenero, lugar, fecha, costo

    if (eventData.tipo) completedFields++;
    if (eventData.deporte || eventData.tipo === "Evento") completedFields++;
    if (eventData.personas || eventData.customCount) completedFields++;
    if (eventData.restriccionGenero) completedFields++;
    if (eventData.lugar) completedFields++;
    if (eventData.dateOption && eventData.hora) completedFields++;
    if (eventData.gratis || eventData.costoNumber > 0) completedFields++;

    const progress = completedFields / totalFields;
    return minSaturation + (maxSaturation - minSaturation) * progress;
  };

  // Gradiente y color según el tipo de evento
  const getCardGradient = () => {
    if (eventData.tipo === "Partido de futbol") {
      return "linear-gradient(90deg, #a9ff68, #FF8989)"; // GRADIENTE MINT BLUSH
    }
    if (eventData.tipo === "Evento") {
      return "linear-gradient(90deg, #145277, #83D0CB)"; // gradient formal
    }
    if (eventData.tipo === "Juegos de mesa") {
      return "linear-gradient(90deg, #84FFC9, #AAB2FF, #ECA0FF)"; // gradient juegos de mesa
    }
    // Default gris para cuando no hay selección
    return "linear-gradient(90deg, #e0e0e0, #f5f5f5)";
  };

  // Handlers para los botones tipo / personas / lugar
  const handleOptionClick = (field, value) => {
    setEventData((prev) => {
      let next = { ...prev };
      if (field === "tipo") {
        next.tipo = value;
        // si se cambia el tipo, reseteamos todo lo posterior
        if (value !== "Partido de futbol" && value !== "Juegos de mesa") {
          next.deporte = "";
        }
        if (value === "Juegos de mesa") {
          next.deporte = ""; // Para Social usaremos deporte para guardar el juego
        }
        next.personas = "";
        next.customCount = "";
        next.cartasTipo = "";
        next.restriccionGenero = "";
        next.lugar = "";
        next.lugarOption = "";
        next.dateOption = "";
        next.rawDate = "";
        next.displayDate = "02 de Febrero";
      }
      if (field === "deporte") {
        next.deporte = value;
        // Resetear todo lo posterior cuando cambia el deporte
        next.cartasTipo = "";
        next.personas = "";
        next.customCount = "";
        next.restriccionGenero = "";
        next.lugar = "";
        next.lugarOption = "";
        next.dateOption = "";
        next.rawDate = "";
        next.displayDate = "02 de Febrero";
      }
      if (field === "cartasTipo") {
        next.cartasTipo = value;
        // Resetear todo lo posterior cuando cambia tipo de cartas
        next.personas = "";
        next.customCount = "";
        next.restriccionGenero = "";
        next.lugar = "";
        next.lugarOption = "";
        next.dateOption = "";
        next.rawDate = "";
        next.displayDate = "02 de Febrero";
      }
      if (field === "personas") {
        next.personas = value;
        // Si selecciona una opción predefinida, limpiar el contador personalizado
        if (value !== "custom") {
          next.customCount = "";
        }
        // Resetear restriccion genero, lugar y fecha cuando cambia personas
        next.restriccionGenero = "";
        next.lugar = "";
        next.lugarOption = "";
        next.dateOption = "";
        next.rawDate = "";
        next.displayDate = "02 de Febrero";
      }
      if (field === "restriccionGenero") {
        next.restriccionGenero = value;
        // Resetear lugar y fecha cuando cambia restriccion
        next.lugar = "";
        next.lugarOption = "";
        next.dateOption = "";
        next.rawDate = "";
        next.displayDate = "02 de Febrero";
      }
      if (field === "lugar") {
        next.lugarOption = value;
        next.lugar = value === "Otro" ? "" : value;
        // Resetear fecha cuando cambia lugar
        next.dateOption = "";
        next.rawDate = "";
        next.displayDate = "02 de Febrero";

        // Actualizar costoLabel según el tipo de lugar
        const isBarOrCafe = value === "Bar" || value === "Cafetería";
        if (next.gratis) {
          next.costoLabel = isBarOrCafe ? "Sin consumo mínimo" : "Gratis";
        } else if (next.costoNumber) {
          next.costoLabel = isBarOrCafe
            ? `Consumo mínimo $${next.costoNumber}`
            : `$${next.costoNumber} por persona`;
        } else {
          next.costoLabel = isBarOrCafe ? "Consumo mínimo pendiente" : "Valor pendiente";
        }
      }
      return next;
    });

    if (field === "tipo") {
      setStep(2);
    }
    if (field === "deporte") {
      // Si selecciona "Cartas", no avanzar aún - esperar sub-selección
      if (value !== "Cartas") {
        setStep(2);
      }
    }
    if (field === "cartasTipo") {
      setStep(2); // Ahora sí avanzar a personas
    }
    if (field === "personas") {
      setStep(3);
    }
    if (field === "restriccionGenero") {
      setStep(4);
    }
    if (field === "lugar") {
      setStep(5);
    }
  };

  // Handler para tabs de fecha (Hoy, Mañana, Otra)
  const handleDateOptionClick = (option) => {
    const meses = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre"
    ];

    let selectedDate;
    if (option === "hoy") {
      selectedDate = new Date();
    } else if (option === "mañana") {
      selectedDate = new Date();
      selectedDate.setDate(selectedDate.getDate() + 1);
    } else {
      // "otra" - dejar vacío para que el usuario seleccione
      setEventData((prev) => ({
        ...prev,
        dateOption: option,
        rawDate: "",
        displayDate: "02 de Febrero"
      }));
      if (eventData.hora) {
        setStep((prev) => Math.max(prev, 6));
      }
      return;
    }

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const rawDate = `${year}-${month}-${day}`;

    const dia = selectedDate.getDate();
    const mes = meses[selectedDate.getMonth()];
    const displayDate = `${dia} de ${mes}`;

    setEventData((prev) => ({
      ...prev,
      dateOption: option,
      rawDate,
      displayDate
    }));

    if (eventData.hora) {
      setStep((prev) => Math.max(prev, 6));
    }
  };

  // Handler fecha (type="date") - solo para "otra"
  const handleDateChange = (value) => {
    if (!value) {
      setEventData((prev) => ({
        ...prev,
        rawDate: "",
        displayDate: "02 de Febrero"
      }));
      return;
    }
    const date = new Date(value + "T00:00:00");
    const meses = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre"
    ];
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    setEventData((prev) => {
      const updated = {
        ...prev,
        rawDate: value,
        displayDate: `${dia} de ${mes}`
      };
      return updated;
    });
    if (value && eventData.hora) {
      setStep((prev) => Math.max(prev, 6));
    }
  };

  // Handler hora
  const handleTimeChange = (value) => {
    setEventData((prev) => {
      const updated = {
        ...prev,
        hora: value || "18:00"
      };
      return updated;
    });
    if (eventData.rawDate && value) {
      setStep((prev) => Math.max(prev, 6));
    }
  };

  // Gratis / no gratis
  const handleGratisChange = (isFree) => {
    setEventData((prev) => {
      const isBarOrCafe = prev.lugarOption === "Bar" || prev.lugarOption === "Cafetería";
      return {
        ...prev,
        gratis: isFree,
        costoLabel: isFree
          ? (isBarOrCafe ? "Sin consumo mínimo" : "Gratis")
          : prev.costoNumber
          ? (isBarOrCafe ? `Consumo mínimo $${prev.costoNumber}` : `$${prev.costoNumber} por persona`)
          : (isBarOrCafe ? "Consumo mínimo pendiente" : "Valor pendiente")
      };
    });
  };

  const handleCostoInput = (value) => {
    const num = Number(value || 0);
    setEventData((prev) => {
      const isBarOrCafe = prev.lugarOption === "Bar" || prev.lugarOption === "Cafetería";
      return {
        ...prev,
        costoNumber: num,
        costoLabel:
          !prev.gratis && num
            ? (isBarOrCafe ? `Consumo mínimo $${num}` : `$${num} por persona`)
            : !prev.gratis
            ? (isBarOrCafe ? "Consumo mínimo pendiente" : "Valor pendiente")
            : (isBarOrCafe ? "Sin consumo mínimo" : "Gratis")
      };
    });
  };

  // Handler para contador personalizado
  const handleCustomCountInput = (value) => {
    const num = value ? parseInt(value) : "";
    setEventData((prev) => ({
      ...prev,
      customCount: num,
      personas: num ? "custom" : "",
      restriccionGenero: ""
    }));
    if (num && num > 0) {
      setStep((prev) => Math.max(prev, 3));
    }
  };

  // Enviar al backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Construir título y payload para tu API
    const title = titleText;

    // Determinar categoría basada en el tipo de evento
    let category = "Evento"; // default
    if (eventData.tipo === "Partido de futbol") {
      category = "Partido";
    } else if (eventData.tipo === "Juegos de mesa") {
      category = "Social"; // Mantener "Social" como categoría en BD
    }

    const subcategory = eventData.personas === "custom"
      ? eventData.customCount.toString()
      : eventData.personas || "";

    // Convertir fecha+hora a ISO para Mongo (Date)
    let dateIso;
    try {
      if (!eventData.rawDate || !eventData.hora) {
        throw new Error("Fecha u hora faltante");
      }
      const isoString = `${eventData.rawDate}T${eventData.hora}:00`;
      const dateObj = new Date(isoString);
      if (isNaN(dateObj.getTime())) throw new Error("Fecha inválida");
      dateIso = dateObj.toISOString();
    } catch {
      alert("Fecha u hora inválida.");
      return;
    }

    const payload = {
      title,
      description: "",
      category,
      subcategory,
      tags: [],
      invitees: [],
      mode: "direct",
      maxParticipants,
      restriccionGenero: eventData.restriccionGenero || "Mixto",
      date: dateIso,
      time: eventData.hora,
      location: eventData.lugar,
      cost: eventData.gratis ? 0 : eventData.costoNumber || 0
    };

    try {
      const res = await fetchWithAuth(`${API_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        alert("Evento creado");
        navigate("/");
      } else {
        alert(
          data.details
            ? `${data.error || "Error al crear evento"}: ${data.details}`
            : data.error || "Error al crear evento"
        );
      }
    } catch (err) {
      console.error(err);
      alert("Error al crear evento");
    }
  };

  // Estilos traducidos de tu CSS a objetos JS
  const styles = {
    bodyBg: {
      backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      backgroundColor: "#e8e8e8",
      minHeight: "100vh",
      padding: isMobile ? "10px" : "20px",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start"
    },
    container: {
      maxWidth: "600px",
      width: "100%",
      margin: "0 auto"
    },
    eventCard: {
      background:
        "linear-gradient(135deg, #d4b5d4 0%, #c8a8d8 50%, #b8c8e8 100%)",
      borderRadius: isMobile ? "14px" : "20px",
      padding: isMobile ? "18px" : "30px",
      marginBottom: isMobile ? "20px" : "30px",
      border: "3px solid #333",
      position: "sticky",
      top: isMobile ? "10px" : "20px",
      zIndex: 10,
      minHeight: isMobile ? "220px" : "350px",
      maxHeight: isMobile ? "260px" : "350px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    },
    eventTitle: {
      fontSize: isMobile ? "40px" : "80px",
      fontWeight: 900,
      lineHeight: 1,
      marginBottom: isMobile ? "30px" : "80px",
      marginTop: "5px",
      fontFamily:
        '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    rating: {
      position: "absolute",
      top: isMobile ? "18px" : "30px",
      right: isMobile ? "18px" : "30px",
      fontSize: isMobile ? "20px" : "32px",
      fontWeight: "bold"
    },
    eventDetails: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    },
    eventLocation: {
      fontSize: isMobile ? "12px" : "16px",
      fontWeight: "bold",
      lineHeight: 1.4,
      fontFamily:
        '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    eventDate: {
      textAlign: "right",
      fontSize: isMobile ? "12px" : "16px",
      fontWeight: "bold",
      lineHeight: 1.4,
      fontFamily:
        '"Bricolage Grotesque", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    questionsSection: {
      background: "rgba(255, 255, 255, 0.5)",
      padding: isMobile ? "15px" : "30px",
      borderRadius: "15px",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    questionGroup: {
      marginBottom: "35px",
      transition: "all 0.4s ease-in-out"
    },
    questionTitle: {
      fontSize: "24px",
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: "20px",
      textTransform: "uppercase",
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive'
    },
    options: {
      display: "flex",
      gap: "15px",
      justifyContent: "center",
      flexWrap: "wrap"
    },
    sketchBtn: (active = false, wide = false, dimmed = false) => ({
      background: active ? "#f0f0f0" : "#fff",
      border: isMobile ? "2px solid #000" : "3px solid #000",
      padding: isMobile ? "10px 16px" : "15px 30px",
      fontSize: isMobile ? "14px" : "18px",
      fontWeight: "bold",
      cursor: "pointer",
      position: "relative",
      textTransform: "uppercase",
      transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: "3px 3px 0 #000",
      minWidth: wide ? "250px" : undefined,
      fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
      opacity: dimmed ? 0.3 : 1,
      filter: dimmed ? "grayscale(1)" : "none",
      transform: dimmed ? "scale(0.85)" : "scale(1)"
    }),
    dateTimeGroup: {
      display: "flex",
      gap: "15px",
      justifyContent: "center",
      flexWrap: "wrap"
    },
    dateInput: {
      border: isMobile ? "2px solid #000" : "3px solid #000",
      padding: isMobile ? "10px 14px" : "15px 20px",
      fontSize: isMobile ? "14px" : "16px",
      textAlign: "center",
      cursor: "pointer",
      boxShadow: isMobile ? "2px 2px 0 #000" : "3px 3px 0 #000",
      background: "#fff",
      minWidth: isMobile ? "100px" : "140px"
    },
    valorInput: {
      border: isMobile ? "2px solid #000" : "3px solid #000",
      padding: isMobile ? "10px 14px" : "15px 20px",
      fontSize: isMobile ? "14px" : "16px",
      textAlign: "center",
      boxShadow: isMobile ? "2px 2px 0 #000" : "3px 3px 0 #000",
      background: "#fff",
      minWidth: isMobile ? "160px" : "250px",
      maxWidth: "100%",
      boxSizing: "border-box"
    }
  };

  return (
    <div style={styles.bodyBg}>
      <div style={styles.container}>
        {/* Tarjeta del evento */}
        <div style={{
          ...styles.eventCard,
          background: getCardGradient(),
          filter: `saturate(${getSaturation()})`
        }}>
          {/* Rating solo si hay personas seleccionadas */}
          {(eventData.personas || eventData.customCount) && (
            <div style={styles.rating}>1/{maxParticipants}</div>
          )}

          {/* Título que se va llenando */}
          <h1 style={styles.eventTitle}>
            {eventData.tipo ? (
              <>
                {titleText.split(" ").slice(0, 2).join("\n").split("\n").map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </React.Fragment>
                ))}
                {titleText.split(" ").slice(2).length > 0 && (
                  <>
                    {" "}
                    {titleText.split(" ").slice(2).join(" ")}
                  </>
                )}
                {personasText && (
                  <>
                    <br />
                    {personasText}
                  </>
                )}
              </>
            ) : (
              "¿Qué hacemos?"
            )}
          </h1>

          <div style={styles.eventDetails}>
            <div style={styles.eventLocation}>
              {eventData.lugar && (
                <>
                  • {eventData.lugar}
                  <br />
                </>
              )}
              {step >= 6 && (
                <>• {eventData.costoLabel}</>
              )}
            </div>
            <div style={styles.eventDate}>
              {eventData.displayDate && eventData.dateOption && (
                <>
                  {eventData.displayDate}
                  <br />
                </>
              )}
              {eventData.hora && eventData.dateOption && (
                <>{eventData.hora} horas</>
              )}
            </div>
          </div>
        </div>

        {/* Zona de preguntas + submit */}
        <form style={styles.questionsSection} onSubmit={handleSubmit}>
          {/* Tipo de actividad */}
          <div
            style={{
              ...styles.questionGroup,
              marginBottom:
                eventData.tipo === "Partido de futbol" && step > 1 ? "16px" : "35px"
            }}
          >
            <h2
              style={{
                ...styles.questionTitle,
                fontSize:
                  eventData.tipo === "Partido de futbol" && step > 1 ? "18px" : "24px"
              }}
            >
              Que hacemos ?
            </h2>
            <div style={styles.options}>
              {["Partido de futbol", "Juegos de mesa", "Evento"].map((val) => {
                const selected = eventData.tipo === val;
                const someSelected = !!eventData.tipo;
                const dimmed = someSelected && !selected;
                return (
                  <button
                    key={val}
                    type="button"
                    style={styles.sketchBtn(selected, false, dimmed)}
                    onClick={() => handleOptionClick("tipo", val)}
                  >
                    {val === "Partido de futbol" ? "Partido" : val === "Juegos de mesa" ? "Juegos" : val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deporte (solo para camino Partido) */}
          {eventData.tipo === "Partido de futbol" && (
            <div
              style={{
                ...styles.questionGroup,
                marginBottom: step > 2 ? "20px" : "28px"
              }}
            >
              <h2 style={styles.questionTitle}>¿Qué deporte?</h2>
              <div style={styles.options}>
                {["Futbol", "Voleyball", "Handball", "Tenis", "Padel", "Basket"].map((val) => {
                  const selected = eventData.deporte === val;
                  const someSelected = !!eventData.deporte;
                  const dimmed = someSelected && !selected;
                  return (
                    <button
                      key={val}
                      type="button"
                      style={styles.sketchBtn(selected, false, dimmed)}
                      onClick={() => handleOptionClick("deporte", val)}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Juegos (solo para camino Social) */}
          {eventData.tipo === "Juegos de mesa" && (
            <div
              style={{
                ...styles.questionGroup,
                marginBottom: step > 2 ? "20px" : "28px"
              }}
            >
              <h2 style={styles.questionTitle}>¿Qué juego?</h2>
              <div style={styles.options}>
                {socialOptions.map((val) => {
                  const selected = eventData.deporte === val;
                  const someSelected = !!eventData.deporte;
                  const dimmed = someSelected && !selected;
                  return (
                    <button
                      key={val}
                      type="button"
                      style={styles.sketchBtn(selected, false, dimmed)}
                      onClick={() => handleOptionClick("deporte", val)}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-opciones de Cartas */}
          {eventData.tipo === "Juegos de mesa" && eventData.deporte === "Cartas" && (
            <div
              style={{
                ...styles.questionGroup,
                marginBottom: eventData.cartasTipo ? "20px" : "28px"
              }}
            >
              <h2 style={styles.questionTitle}>Que tipo de cartas?</h2>
              <div style={styles.options}>
                {cartasOptions.map((val) => {
                  const selected = eventData.cartasTipo === val;
                  const someSelected = !!eventData.cartasTipo;
                  const dimmed = someSelected && !selected;
                  return (
                    <button
                      key={val}
                      type="button"
                      style={styles.sketchBtn(selected, false, dimmed)}
                      onClick={() => handleOptionClick("cartasTipo", val)}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Número de personas */}
          {step >= 2 &&
            ((eventData.tipo === "Partido de futbol" && eventData.deporte) ||
             (eventData.tipo === "Juegos de mesa" && eventData.deporte && (eventData.deporte !== "Cartas" || eventData.cartasTipo)) ||
             (eventData.tipo === "Evento")) && (
              <div
                style={{
                  ...styles.questionGroup,
                  marginBottom: step > 3 ? "20px" : "35px"
                }}
              >
                <h2
                  style={{
                    ...styles.questionTitle,
                    fontSize: step > 3 ? "20px" : "24px"
                  }}
                >
                  Para cuántas personas?
                </h2>
              <div style={styles.options}>
                {/* Opciones predefinidas para deportes */}
                {eventData.tipo === "Partido de futbol" && personasOptions[eventData.deporte] &&
                  personasOptions[eventData.deporte].map((val) => {
                    const selected = eventData.personas === val && !eventData.customCount;
                    const someSelected = !!eventData.personas || !!eventData.customCount;
                    const dimmed = someSelected && !selected;
                    return (
                      <button
                        key={val}
                        type="button"
                        style={styles.sketchBtn(selected, false, dimmed)}
                        onClick={() => handleOptionClick("personas", val)}
                      >
                        {val}
                      </button>
                    );
                  })}

                {/* Para Social y Evento, solo mostrar contador */}
                {(eventData.tipo === "Juegos de mesa" || eventData.tipo === "Evento") && (
                  <input
                    type="number"
                    style={{
                      ...styles.valorInput,
                      minWidth: "200px"
                    }}
                    placeholder="Número de personas"
                    value={eventData.customCount || ""}
                    onChange={(e) => handleCustomCountInput(e.target.value)}
                    min={1}
                  />
                )}
              </div>
              </div>
            )}

          {/* Restricción de género */}
          {step >= 3 && (eventData.personas || eventData.customCount) && (
            <div
              style={{
                ...styles.questionGroup,
                marginBottom: step > 3 ? "20px" : "35px"
              }}
            >
              <h2
                style={{
                  ...styles.questionTitle,
                  fontSize: step > 3 ? "20px" : "24px"
                }}
              >
                Restriccion de genero?
              </h2>
              <div style={styles.options}>
                {["Solo hombres", "Solo mujeres", "Mixto"].map((val) => {
                  const selected = eventData.restriccionGenero === val;
                  const someSelected = !!eventData.restriccionGenero;
                  const dimmed = someSelected && !selected;
                  return (
                    <button
                      key={val}
                      type="button"
                      style={styles.sketchBtn(selected, false, dimmed)}
                      onClick={() => handleOptionClick("restriccionGenero", val)}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lugar */}
          {step >= 4 && (
            <div
              style={{
                ...styles.questionGroup,
                marginBottom: step > 5 ? "20px" : "35px"
              }}
            >
              <h2 style={styles.questionTitle}>Donde ?</h2>

              {/* Opciones para Social */}
              {eventData.tipo === "Juegos de mesa" && (
                <>
                  <div style={styles.options}>
                    {["Bar", "Cafetería", "Tienda", "Biblioteca", "Plaza"].map((val) => {
                      const selected = eventData.lugarOption === val;
                      const someSelected = !!eventData.lugarOption && !["Otro"].includes(eventData.lugarOption);
                      const dimmed = someSelected && !selected;
                      return (
                        <button
                          key={val}
                          type="button"
                          style={styles.sketchBtn(selected, false, dimmed)}
                          onClick={() => handleOptionClick("lugar", val)}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ ...styles.options, marginTop: 15 }}>
                    <input
                      type="text"
                      style={styles.valorInput}
                      placeholder="Ingresa otra ubicación..."
                      value={eventData.lugarOption === "Otro" ? eventData.lugar : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEventData((prev) => ({
                          ...prev,
                          lugar: value,
                          lugarOption: value ? "Otro" : ""
                        }));
                        if (value) {
                          setStep((prev) => Math.max(prev, 5));
                        }
                      }}
                    />
                  </div>
                </>
              )}

              {/* Opciones para Partido y Evento */}
              {eventData.tipo !== "Juegos de mesa" && (
                <>
                  <div style={styles.options}>
                    <select
                      style={styles.dateInput}
                      value={eventData.lugarOption}
                      onChange={(e) => handleOptionClick("lugar", e.target.value)}
                    >
                      <option value="" disabled>
                        Qué cancha
                      </option>
                      <option value="Parque Ecuador">Parque Ecuador</option>
                      <option value="Canchas Universidad">Canchas Universidad</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  {eventData.lugarOption === "Otro" && (
                    <div style={{ ...styles.options, marginTop: 10 }}>
                      <input
                        type="text"
                        style={styles.valorInput}
                        placeholder="Escribe el lugar..."
                        value={eventData.lugarOption === "Otro" ? eventData.lugar : ""}
                        onChange={(e) =>
                          setEventData((prev) => ({
                            ...prev,
                            lugar: e.target.value
                          }))
                        }
                        required
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Fecha y hora */}
          {step >= 5 && (
            <div
              style={{
                ...styles.questionGroup,
                marginBottom: step > 6 ? "20px" : "35px"
              }}
            >
              <h2 style={styles.questionTitle}>Cuando ?</h2>

              {/* Tabs de fecha */}
              <div style={styles.options}>
                {["hoy", "mañana", "otra fecha"].map((val) => {
                  const selected = eventData.dateOption === val;
                  const someSelected = !!eventData.dateOption;
                  const dimmed = someSelected && !selected;
                  return (
                    <button
                      key={val}
                      type="button"
                      style={styles.sketchBtn(selected, false, dimmed)}
                      onClick={() => handleDateOptionClick(val)}
                    >
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  );
                })}
              </div>

              {/* Input de fecha (solo si selecciona "otra") */}
              {eventData.dateOption === "otra" && (
                <div style={{ ...styles.options, marginTop: 15 }}>
                  <div
                    style={styles.dateInput}
                    onClick={() => {
                      if (dateInputRef.current && dateInputRef.current.showPicker) {
                        dateInputRef.current.showPicker();
                      }
                    }}
                  >
                    <input
                      ref={dateInputRef}
                      type="date"
                      style={{ border: "none", background: "transparent", width: "100%", cursor: "pointer" }}
                      value={eventData.rawDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Hora (siempre visible debajo) */}
              {eventData.dateOption && (
                <div style={{ ...styles.options, marginTop: 15 }}>
                  <div style={styles.dateInput}>
                    <input
                      type="time"
                      value={eventData.hora}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      style={{
                        border: "none",
                        background: "transparent",
                        width: "100%",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                        fontWeight: "bold",
                        textAlign: "center",
                        outline: "none"
                      }}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gratis / Pago o Consumo mínimo */}
          {step >= 6 && (
            <div style={styles.questionGroup}>
              {/* Si es Bar o Cafetería, preguntar por consumo mínimo */}
              {(eventData.lugarOption === "Bar" || eventData.lugarOption === "Cafetería") ? (
                <>
                  <h2 style={styles.questionTitle}>Consumo mínimo ?</h2>
                  <div style={styles.options}>
                    <button
                      type="button"
                      style={styles.sketchBtn(!eventData.gratis, false, eventData.gratis)}
                      onClick={() => handleGratisChange(false)}
                    >
                      Si
                    </button>
                    <button
                      type="button"
                      style={styles.sketchBtn(eventData.gratis, false, !eventData.gratis)}
                      onClick={() => handleGratisChange(true)}
                    >
                      No
                    </button>
                  </div>
                  {!eventData.gratis && (
                    <div style={{ ...styles.options, marginTop: 15 }}>
                      <input
                        type="number"
                        style={styles.valorInput}
                        placeholder="Consumo mínimo por persona"
                        value={eventData.costoNumber || ""}
                        onChange={(e) => handleCostoInput(e.target.value)}
                        min={0}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 style={styles.questionTitle}>Gratis ?</h2>
                  <div style={styles.options}>
                    <button
                      type="button"
                      style={styles.sketchBtn(eventData.gratis, false, !eventData.gratis)}
                      onClick={() => handleGratisChange(true)}
                    >
                      Si
                    </button>
                    <button
                      type="button"
                      style={styles.sketchBtn(!eventData.gratis, false, eventData.gratis)}
                      onClick={() => handleGratisChange(false)}
                    >
                      No
                    </button>
                  </div>
                  {!eventData.gratis && (
                    <div style={{ ...styles.options, marginTop: 15 }}>
                      <input
                        type="number"
                        style={styles.valorInput}
                        placeholder="Valor por persona"
                        value={eventData.costoNumber || ""}
                        onChange={(e) => handleCostoInput(e.target.value)}
                        min={0}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Botón crear evento */}
          {step >= 6 && (eventData.gratis || (!eventData.gratis && eventData.costoNumber > 0)) && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                type="submit"
                style={{
                  background: getCardGradient(),
                  border: "3px solid #000",
                  padding: "15px 40px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  boxShadow: "4px 4px 0 #000",
                  fontFamily: '"Patrick Hand", "Comic Sans MS", system-ui, cursive',
                  color: "#000",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translate(-2px, -2px)";
                  e.currentTarget.style.boxShadow = "6px 6px 0 #000";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translate(0, 0)";
                  e.currentTarget.style.boxShadow = "4px 4px 0 #000";
                }}
              >
                Crear Evento ✓
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
