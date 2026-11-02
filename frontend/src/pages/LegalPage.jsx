import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LEGAL } from "../config/legal";

// Términos y condiciones y Política de privacidad.
// Texto en lenguaje simple, basado en lo que la app hace hoy. Al cambiar algo importante,
// actualizar la versión en config/legal.js y en backend/src/config.js.

const S = {
  wrapper: {
    minHeight: "100vh",
    backgroundImage: "url('/assets/distorted-grid-line-png-pattern.jpg')",
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
    backgroundColor: "#e8e8e8",
    padding: "24px 16px 60px"
  },
  card: {
    maxWidth: "760px",
    margin: "0 auto",
    background: "rgba(255,255,255,0.96)",
    border: "3px solid #333",
    borderRadius: "16px",
    padding: "28px clamp(18px, 5vw, 44px)",
    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
    color: "#111",
    lineHeight: 1.6,
    fontSize: "16px"
  },
  back: {
    display: "block", margin: "0 auto 16px", maxWidth: "760px", width: "100%", textAlign: "left",
    background: "none", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: 700,
    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', padding: 0
  },
  h1: { fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 6px" },
  meta: { color: "#555", fontSize: "14px", margin: "0 0 24px" },
  h2: { fontSize: "20px", fontWeight: 800, margin: "28px 0 8px" },
  ul: { paddingLeft: "22px", margin: "8px 0" },
  nota: { background: "#f4f4f4", border: "2px solid #ddd", borderRadius: "10px", padding: "12px 14px", fontSize: "15px" }
};

function Layout({ titulo, children }) {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [titulo]); // empezar arriba al llegar desde otra página
  return (
    <div style={S.wrapper}>
      <button style={S.back} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>← Volver</button>
      <article style={S.card}>
        <h1 style={S.h1}>{titulo}</h1>
        <p style={S.meta}>Vigente desde el {LEGAL.versionTexto}</p>
        {children}
      </article>
    </div>
  );
}

const Contacto = () => <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

export function TerminosPage() {
  return (
    <Layout titulo="Términos y condiciones">
      <p>
        Estos términos explican cómo funciona Kiu y qué esperamos de quienes lo usan. Al crear una cuenta o
        iniciar sesión aceptas estos términos y la <Link to="/privacidad">Política de privacidad</Link>.
      </p>

      <h2 style={S.h2}>1. Qué es Kiu</h2>
      <p>
        Kiu es una plataforma para publicar y encontrar actividades con otras personas: partidos, juegos de mesa,
        clases y otros planes. Kiu la administra {LEGAL.responsable} ({LEGAL.ciudad}).
      </p>
      <p>
        Kiu solo conecta a las personas. <strong>Cada evento lo organiza quien lo publica</strong>, que es responsable de
        lo que ofrece: el lugar, el horario, el costo y lo que pasa durante la actividad. Kiu no organiza los eventos ni
        está presente en ellos.
      </p>

      <h2 style={S.h2}>2. Tu cuenta</h2>
      <ul style={S.ul}>
        <li>Debes tener al menos {LEGAL.edadMinima} años.</li>
        <li>Los datos que ingresas tienen que ser verdaderos, incluido tu género si te unes a eventos con restricción de género.</li>
        <li>La cuenta es personal: una por persona. Cuida tu contraseña y avísanos si alguien más la usa.</li>
        <li>Puedes borrar tu cuenta cuando quieras desde tu perfil.</li>
      </ul>

      <h2 style={S.h2}>3. Reglas de convivencia</h2>
      <p>Al usar Kiu te comprometes a:</p>
      <ul style={S.ul}>
        <li>Tratar a los demás con respeto: nada de insultos, acoso, amenazas ni discriminación.</li>
        <li>Publicar eventos reales, con información correcta, y avisar si cambian o se cancelan.</li>
        <li>No usar Kiu para vender, hacer publicidad o enviar spam.</li>
        <li>No publicar eventos ilegales o peligrosos, ni contenido sexual, violento u ofensivo.</li>
        <li>Si te inscribes y no vas a ir, salir del evento para liberar tu cupo.</li>
      </ul>

      <h2 style={S.h2}>4. Eventos con costo</h2>
      <p>
        Si un evento tiene costo (por ejemplo, el arriendo de una cancha), el pago se acuerda directamente entre el
        organizador y los participantes, fuera de Kiu. Kiu no cobra, no recibe pagos y no responde por ellos.
      </p>

      <h2 style={S.h2}>5. Tu seguridad</h2>
      <p>
        Participas en las actividades por tu cuenta y riesgo, en especial en las deportivas. Te recomendamos juntarte en
        lugares públicos, avisar a alguien de confianza dónde vas a estar y reportar cualquier situación que te incomode.
      </p>

      <h2 style={S.h2}>6. Reportes y moderación</h2>
      <p>
        Puedes reportar a un usuario o un evento desde la app. Revisamos cada reporte y podemos eliminar eventos o
        contenido, sumar advertencias (strikes) a una cuenta y suspenderla si no cumple estos términos.
      </p>

      <h2 style={S.h2}>7. Lo que publicas</h2>
      <p>
        Lo que escribes en Kiu (eventos, mensajes en el muro) sigue siendo tuyo. Nos das permiso para mostrarlo dentro
        de Kiu a las personas que corresponda, según la <Link to="/privacidad">Política de privacidad</Link>.
      </p>

      <h2 style={S.h2}>8. Disponibilidad</h2>
      <p>
        Hacemos lo posible para que Kiu funcione bien, pero el servicio se ofrece tal como está y puede tener fallas o
        interrupciones. Kiu no responde por los daños que surjan de los eventos ni del trato entre usuarios, en la medida
        que la ley lo permita.
      </p>

      <h2 style={S.h2}>9. Cambios a estos términos</h2>
      <p>
        Si cambiamos estos términos, publicaremos la nueva versión con su fecha y, si el cambio es importante, te avisaremos
        en la app. Estos términos se rigen por las leyes de Chile.
      </p>

      <h2 style={S.h2}>10. Contacto</h2>
      <p>Para consultas o reclamos escríbenos a <Contacto />.</p>
    </Layout>
  );
}

export function PrivacidadPage() {
  return (
    <Layout titulo="Política de privacidad">
      <p>
        Esta política explica qué datos personales usa Kiu, para qué, quién puede verlos y qué derechos tienes. Se aplica
        a la web y a la app de Kiu.
      </p>
      <p style={S.nota}>
        En resumen: pedimos lo necesario para que puedas organizar y unirte a eventos. No vendemos tus datos ni los usamos
        para publicidad. Nunca mostramos tu email, teléfono ni fecha de nacimiento a otros usuarios. Puedes descargar tus
        datos o borrar tu cuenta cuando quieras desde tu perfil.
      </p>

      <h2 style={S.h2}>1. Quién es responsable</h2>
      <p>
        El responsable de tus datos es {LEGAL.responsable} ({LEGAL.ciudad}). Para cualquier consulta sobre tus datos
        escribe a <Contacto />.
      </p>

      <h2 style={S.h2}>2. Qué datos usamos</h2>
      <ul style={S.ul}>
        <li><strong>Tu cuenta:</strong> nombre, apellido, email, contraseña (guardada cifrada, nadie puede leerla), género, fecha de nacimiento y teléfono si lo agregas.</li>
        <li><strong>Si entras con Google o Facebook:</strong> tu nombre, tu email y un identificador de esa cuenta. No recibimos tu contraseña de Google o Facebook.</li>
        <li><strong>Tu actividad en Kiu:</strong> los eventos que creas o a los que te unes, los mensajes que escribes en los muros, lo que te anotas a llevar, tus notificaciones y los reportes que envías.</li>
        <li><strong>Datos técnicos:</strong> registros del servidor (por ejemplo, la dirección IP) para seguridad y para limitar intentos de inicio de sesión, y errores de la app para poder corregirlos. Tu sesión se guarda en tu navegador.</li>
        <li><strong>Estadísticas de uso:</strong> contamos acciones dentro de Kiu (cuántos eventos se crean, cuántas personas se unen) para mejorar el servicio. No usamos cookies de publicidad ni herramientas de seguimiento de terceros.</li>
      </ul>

      <h2 style={S.h2}>3. Para qué los usamos</h2>
      <ul style={S.ul}>
        <li>Crear y mantener tu cuenta.</li>
        <li>Mostrar los eventos, las listas de participantes y los muros.</li>
        <li>Aplicar la restricción de género de un evento (por eso pedimos tu género) y comprobar la edad mínima (por eso pedimos tu fecha de nacimiento).</li>
        <li>Enviarte avisos en la app y por email sobre los eventos en que participas: recordatorios, cambios, confirmaciones y cancelaciones.</li>
        <li>Mantener Kiu seguro: revisar reportes, sumar advertencias y suspender cuentas que no cumplen los <Link to="/terminos">Términos</Link>.</li>
        <li>Entender cómo se usa Kiu, con números agregados, para mejorarlo.</li>
      </ul>

      <h2 style={S.h2}>4. Quién puede ver qué</h2>
      <ul style={S.ul}>
        <li><strong>Cualquier persona, sin cuenta:</strong> el título, la fecha, el lugar y el costo de un evento, el nombre de quien lo organiza y cuántas personas van.</li>
        <li><strong>Usuarios con sesión:</strong> además, el nombre y apellido de los participantes, los mensajes del muro, lo que cada uno lleva, y tu perfil público (nombre, fecha en que te registraste, si estás verificado, tus advertencias y cuántos eventos creaste o en cuántos participaste).</li>
        <li><strong>Nadie más que tú:</strong> tu email, tu teléfono, tu fecha de nacimiento y tu género no se muestran a otros usuarios.</li>
        <li><strong>El equipo de Kiu:</strong> los administradores pueden ver los datos de las cuentas para moderar y dar soporte.</li>
      </ul>

      <h2 style={S.h2}>5. Con quién los compartimos</h2>
      <p>
        No vendemos ni arrendamos tus datos. Para funcionar, Kiu usa proveedores que guardan o procesan datos por nosotros:
        Vercel (sitio web), Render (servidor), MongoDB Atlas (base de datos) y un proveedor de email para los avisos.
        Si entras con Google o Facebook, esos servicios también intervienen. Algunos de estos proveedores guardan datos
        fuera de Chile, por ejemplo en Estados Unidos. Solo entregaríamos datos a una autoridad si la ley nos obliga.
      </p>

      <h2 style={S.h2}>6. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas tu cuenta. Si la borras, eliminamos tu perfil, tus notificaciones, tus mensajes en los muros, tus
        inscripciones y los eventos que creaste (si alguno todavía no ocurría, avisamos a los inscritos que se canceló).
        Las estadísticas de uso y los reportes que enviaste quedan sin tu nombre. Las copias de respaldo de la base de
        datos se reemplazan con el tiempo; tus datos desaparecen de ellas en un plazo máximo de 60 días.
      </p>

      <h2 style={S.h2}>7. Tus derechos</h2>
      <p>Puedes, en cualquier momento:</p>
      <ul style={S.ul}>
        <li><strong>Acceder</strong> a tus datos y llevártelos: en tu perfil, "Descargar mis datos".</li>
        <li><strong>Corregirlos:</strong> en tu perfil, "Editar".</li>
        <li><strong>Eliminarlos:</strong> en tu perfil, "Borrar mi cuenta".</li>
        <li><strong>Oponerte</strong> a algún uso o pedir que lo limitemos, escribiéndonos a <Contacto />.</li>
      </ul>
      <p>
        Respondemos dentro de 30 días. Si no quedas conforme con la respuesta, puedes reclamar ante la autoridad
        competente en Chile, conforme a la ley de protección de datos personales.
      </p>

      <h2 style={S.h2}>8. Edad mínima</h2>
      <p>Kiu es para personas de {LEGAL.edadMinima} años o más. Si sabemos que una cuenta es de una persona menor, la eliminamos.</p>

      <h2 style={S.h2}>9. Seguridad</h2>
      <p>
        Las contraseñas se guardan cifradas, la conexión con Kiu es cifrada (HTTPS) y solo los administradores acceden a
        los datos completos. Ningún sistema es infalible: si detectamos un problema de seguridad que afecte tus datos, te
        avisaremos.
      </p>

      <h2 style={S.h2}>10. Cambios a esta política</h2>
      <p>
        Si la cambiamos, publicaremos la nueva versión con su fecha y, si el cambio es importante, te avisaremos en la app.
      </p>
    </Layout>
  );
}
