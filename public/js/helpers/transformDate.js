function formatearFechaConHora(fechaString) {
  if (!fechaString) return "";

  try {
    const fecha = new Date(fechaString);

    if (isNaN(fecha.getTime())) {
      return "";
    }

    const opciones = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Para formato 24 horas
    };

    return fecha.toLocaleDateString("es-AR", opciones);
  } catch (error) {
    console.error("Error al formatear la fecha:", error);
    return "";
  }
}

// Ejemplo: "07/12/2025 21:57"
