// /js/registers.js - VERSIÓN CORREGIDA

import { initCanvasViewer } from "./helpers/canvas.js";

// Inicializar el visor de canvas
initCanvasViewer();

// Botón Nuevo Registro
const newRegisterBtn = document.getElementById("new_register");
if (newRegisterBtn) {
  newRegisterBtn.addEventListener("click", () => {
    window.location.href = "/new-register";
  });
}

// === DEBUG: Verificar que los botones existen ===
document.addEventListener("DOMContentLoaded", function () {
  console.log("Documento cargado, buscando botones de documentos...");
  const docButtons = document.querySelectorAll(".document-action");
  console.log(`Encontrados ${docButtons.length} botones de documentos`);

  docButtons.forEach((btn, index) => {
    console.log(`Botón ${index}:`, {
      id: btn.dataset.certificateId,
      type: btn.dataset.certificateType,
      html: btn.innerHTML,
    });
  });
});

// === MANEJADOR SIMPLIFICADO PARA DOCUMENTOS ===
document.addEventListener("click", function (e) {
  console.log("Click detectado en:", e.target);
  console.log("Clases:", e.target.className);

  // Encontrar el botón más cercano (incluye si clic en el icono dentro del botón)
  let button = e.target;

  // Si el clic fue en un icono dentro del botón, subir al botón padre
  if (button.tagName === "I" && button.closest(".document-action")) {
    button = button.closest(".document-action");
  }

  // Si el clic fue directamente en el botón o en su texto
  if (button.classList.contains("document-action")) {
    e.preventDefault();
    console.log("Botón de documento clickeado:", button);

    const certificateId = button.dataset.certificateId;
    const certificateType = button.dataset.certificateType;
    const controlId = button.dataset.controlId;

    console.log("Datos del botón:", {
      certificateId,
      certificateType,
      controlId,
    });

    // Usar preview por defecto
    handleDocumentAction("preview", certificateId, certificateType, controlId);
    return;
  }

  // === MANEJAR ACCIONES DE REGISTROS (tu código original) ===
  const btn = e.target.closest(".btn-action");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "show-canvas") return;

  e.preventDefault();

  if (action === "download-pdf") {
    handlePdfDownload(btn, id);
    return;
  }

  if (action === "documentation") {
    window.location.href = `/doc-register/${id}`;
    return;
  }

  console.warn("Acción no reconocida:", action);
});

// === FUNCIÓN SIMPLIFICADA PARA DOCUMENTOS ===
async function handleDocumentAction(
  action,
  certificateId,
  certificateType,
  controlId,
) {
  console.log(`Ejecutando acción ${action} para certificado ${certificateId}`);

  try {
    // Verificar que tengamos un ID
    if (!certificateId) {
      console.error("No hay certificateId");
      alert("Error: ID de documento no válido");
      return;
    }

    let url;

    switch (action) {
      case "preview":
        url = `/api/cert/${certificateId}/preview`;
        console.log("Abriendo URL:", url);
        window.open(url, "_blank");
        break;

      case "download":
        url = `/api/cert/${certificateId}/download`;
        console.log("Redirigiendo a:", url);
        window.location.href = url;
        break;

      default:
        console.log("Acción no reconocida:", action);
    }
  } catch (error) {
    console.error("Error en acción de documento:", error);
    alert("Error al procesar la acción del documento: " + error.message);
  }
}

// === FUNCIÓN PARA DESCARGAR PDF (tu código original) ===
async function handlePdfDownload(btn, id) {
  let originalHTML = "";

  try {
    originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass"></i> Generando...';

    const response = await fetch(`/api/registers-control/pdf/${id}`);

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `registro_${id}.pdf`;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error descargando PDF:", error);
    alert("Error al generar el PDF. Por favor, intente nuevamente.");

    if (!originalHTML) {
      originalHTML = '<i class="bi bi-download"></i> PDF';
    }
  } finally {
    if (btn && originalHTML) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    } else if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-download"></i> PDF';
    }
  }
}

// === REMOVER EL MANEJO DE MENÚ CONTEXTUAL (temporalmente) ===
// Comenta o elimina esta sección hasta que lo básico funcione
