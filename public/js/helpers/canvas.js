// /js/helpers/canvas.js - VERSIÓN CON IMAGEN SUPERIOR
export function initCanvasViewer() {
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('[data-action="show-canvas"]');
    if (!btn) return;

    e.preventDefault();

    const card = btn.closest(".col-12");
    if (!card || !card.dataset.register) {
      console.error("No se encontraron datos para el canvas");
      return;
    }

    try {
      const data = JSON.parse(card.dataset.register);
      generateCanvasModal(data);
    } catch (error) {
      console.error("Error parseando JSON:", error);
    }
  });
}

function generateCanvasModal(data) {
  const modalId = "canvasModal-" + Date.now();

  const modalHTML = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}-label">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}-label">
              <i class="bi bi-card-text"></i>
              Vista previa del formulario
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <div class="text-center mb-3">
              <canvas id="canvas-${modalId}" width="794" height="1123" 
                      style="border: 1px solid #dee2e6; background: white; max-width: 100%; height: auto;"></canvas>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="bi bi-x-circle"></i> Cerrar
            </button>
            <button type="button" class="btn btn-success" id="download-${modalId}">
              <i class="bi bi-download"></i> Descargar PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modalElement = document.getElementById(modalId);
  const modal = new bootstrap.Modal(modalElement, {
    backdrop: true,
    keyboard: true,
    focus: true,
  });

  modal.show();

  // Agregar estos eventos ANTES de mostrar el modal
  modalElement.addEventListener("shown.bs.modal", function () {
    const canvas = document.getElementById(`canvas-${modalId}`);
    const ctx = canvas.getContext("2d");
    drawExactForm(ctx, canvas, data);
  });

  modalElement.addEventListener("shown.bs.modal", function () {
    const canvas = document.getElementById(`canvas-${modalId}`);
    document
      .getElementById(`download-${modalId}`)
      .addEventListener("click", function () {
        const link = document.createElement("a");
        link.download = `formulario_${data.id || "temp"}_${new Date().toISOString().split("T")[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
  });

  // IMPORTANTE: Manejar el cierre correctamente
  modalElement.addEventListener("hide.bs.modal", function () {
    // Remover foco del botón Cerrar antes de ocultar
    document.activeElement.blur();
  });

  modalElement.addEventListener("hidden.bs.modal", function () {
    // Limpiar completamente
    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((backdrop) => backdrop.remove());

    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";

    // Eliminar eventos antes de remover
    const downloadBtn = document.getElementById(`download-${modalId}`);
    if (downloadBtn) {
      downloadBtn.replaceWith(downloadBtn.cloneNode(true));
    }

    // Finalmente eliminar el modal
    setTimeout(() => {
      this.remove();
    }, 150);
  });
}

// ============================================
// DIBUJAR FORMULARIO EXACTO CON IMAGEN SUPERIOR
// ============================================
function drawExactForm(ctx, canvas, data) {
  // LIMPIAR TODO EL CANVAS
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // FONDO GRIS
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // CARGAR IMAGEN SUPERIOR
  const topImage = new Image();

  topImage.onload = function () {
    // Calcular proporciones para mantener relación de aspecto
    const canvasWidth = canvas.width;

    const imagenX = 30; // 50px desde el borde izquierdo
    const imagenY = 15; // 20px desde el borde superior (antes era 50)
    const imagenAncho = canvasWidth - 30; // 100px menos que el ancho total (márgenes)
    const imagenAlto = 210; // ALTURA FIJA de 150px (antes se calculaba proporcional)

    // 1. DIBUJAR LA IMAGEN
    ctx.drawImage(
      topImage,
      0,
      0,
      topImage.width,
      topImage.height,
      imagenX,
      imagenY,
      imagenAncho,
      imagenAlto,
    );

    // 2. EMPEZAR FORMULARIO MUCHO MÁS ARRIBA
    let y = imagenY + imagenAlto + 5; // Solo 20px después de la imagen

    drawFormSections(ctx, canvas, data, y);
  };

  topImage.onerror = function () {
    console.error(
      "❌ Error cargando imagen superior:",
      "/images/headerPdf.png",
    );
    // Si falla la imagen, empezar desde arriba
    let y = 40;
    drawFormSections(ctx, canvas, data, y);
  };

  // Cargar imagen CON timestamp para evitar caché
  topImage.src = "/images/nuevo_header.png?" + new Date().getTime();
}

function drawFormSections(ctx, canvas, data, startY) {
  let y = startY;

  // ============================================
  // 1. ANEXO II
  // ============================================
  ctx.fillStyle = "#000000";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";

  ctx.fillText("ANEXO II", canvas.width / 2, y);
  y += 25;

  const anexoWidth = canvas.width - 100;
  const anexoHeight = 120;
  const anexoX = 50;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(anexoX, y, anexoWidth, anexoHeight);

  ctx.font = "14px Arial";
  ctx.textAlign = "left";

  // Columna izquierda
  let colY = y + 25;

  if (data.fecha) {
    const fecha = new Date(data.fecha);
    const fechaTexto = fecha.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const horaTexto = fecha.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    ctx.fillText(`Fecha: ${fechaTexto}`, anexoX + 20, colY);
    colY += 25;
    ctx.fillText(`Hora: ${horaTexto}`, anexoX + 20, colY);
    colY += 25;
  }

  ctx.fillText(`Lugar: ${data.lugar || ""}`, anexoX + 20, colY);

  // Columna derecha
  colY = y + 25;
  ctx.fillText(
    `Empresa: ${data.empresa_select || ""}`,
    anexoX + anexoWidth / 2 + 20,
    colY,
  );
  colY += 25;
  ctx.fillText(
    `Dominio: ${data.dominio || ""}`,
    anexoX + anexoWidth / 2 + 20,
    colY,
  );
  colY += 25;
  ctx.fillText(
    `Interno: ${data.interno || ""}`,
    anexoX + anexoWidth / 2 + 20,
    colY,
  );

  y += anexoHeight + 30;

  // ============================================
  // 2. SECCIÓN "SERVICIO:" - CENTRADA
  // ============================================
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SERVICIO:", canvas.width / 2, y);

  ctx.textAlign = "left";
  y += 25;
  ctx.font = "14px Arial";

  // Opciones de servicio distribuidas uniformemente
  const totalWidth = canvas.width - 100;
  const segmento = totalWidth / 3;

  let xPos = 50;

  // Regular
  ctx.fillText("Regular", xPos, y);
  drawShortLine(ctx, xPos + 60, y - 5, xPos + 150, y - 5);

  xPos += segmento;

  // Sin fines de lucro
  const textoFines = "Sin fines de lucro";
  const anchoFines = ctx.measureText(textoFines).width;
  const inicioFines = xPos - anchoFines / 2;
  ctx.fillText(textoFines, inicioFines, y);
  drawShortLine(
    ctx,
    inicioFines + anchoFines + 10,
    y - 5,
    inicioFines + anchoFines + 100,
    y - 5,
  );

  xPos += segmento;

  // A demanda
  const textoDemanda = "A demanda";
  const anchoDemanda = ctx.measureText(textoDemanda).width;
  const inicioDemanda = xPos - anchoDemanda / 2;
  ctx.fillText(textoDemanda, inicioDemanda, y);
  drawShortLine(
    ctx,
    inicioDemanda + anchoDemanda + 10,
    y - 5,
    inicioDemanda + anchoDemanda + 100,
    y - 5,
  );

  y += 40;

  // ============================================
  // 3. TABLA DE SERVICIOS (SIN LÍNEAS INTERNAS)
  // ============================================
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";

  // Posiciones de las columnas
  const columnaSIX = 200;
  const columnaNOX = 240;
  const columnaVencimientoX = 320;
  const columnaPlanillaX = 460;

  // Títulos de las columnas
  ctx.fillText("SÍ", columnaSIX, y);
  ctx.fillText("NO", columnaNOX, y);
  ctx.fillText("Vencimiento", columnaVencimientoX, y);
  ctx.fillText("N° Planilla", columnaPlanillaX, y);

  y += 35;

  // Lista de servicios con sus datos correspondientes
  const servicios = [
    {
      nombre: "G. Matriculación",
      tiene: !!data.c_matriculacion_cert,
      vencimiento: data.c_matriculacion_venc,
      planilla: data.c_matriculacion_cert,
    },
    {
      nombre: "Seguro",
      tiene: !!data.seguro_cert,
      vencimiento: data.seguro_venc,
      planilla: data.seguro_cert,
    },
    {
      nombre: "R.T.O",
      tiene: !!data.rto_cert,
      vencimiento: data.rto_venc,
      planilla: data.rto_cert,
    },
    {
      nombre: "Tacógrafo",
      tiene: !!data.tacografo_cert,
      vencimiento: data.tacografo_venc,
      planilla: data.tacografo_cert,
    },
  ];

  ctx.font = "15px Arial";

  servicios.forEach((servicio) => {
    // Nombre del servicio
    ctx.textAlign = "left";
    ctx.fillText(servicio.nombre, 50, y);

    // Checkboxes SÍ/NO
    ctx.textAlign = "center";

    // Checkbox SÍ
    if (servicio.tiene) {
      ctx.fillText("✓", columnaSIX, y);
    } else {
      ctx.strokeRect(columnaSIX - 8, y - 12, 16, 16);
    }

    // Checkbox NO
    if (!servicio.tiene) {
      ctx.fillText("✓", columnaNOX, y);
    } else {
      ctx.strokeRect(columnaNOX - 8, y - 12, 16, 16);
    }

    // Fecha de vencimiento
    if (servicio.vencimiento) {
      const fechaVenc = new Date(servicio.vencimiento);
      const fechaFormateada = fechaVenc.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      ctx.fillText(fechaFormateada, columnaVencimientoX, y);
    }

    // Número de planilla
    if (servicio.planilla) {
      ctx.fillText(servicio.planilla.toString(), columnaPlanillaX, y);
    }

    y += 30;
  });

  y += 40;

  // ============================================
  // 4. SEPARADOR (línea punteada)
  // ============================================
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(50, y);
  ctx.lineTo(canvas.width - 50, y);
  ctx.stroke();
  ctx.setLineDash([]);

  y += 40;

  // ============================================
  // 5. TÍTULO "CONDUCTOR"
  // ============================================
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left"; // Asegurar alineación izquierda
  ctx.fillText("CONDUCTOR", 90, y);
  y += 35;

  // ============================================
  // 6. DATOS DEL CONDUCTOR - VERSIÓN FINAL CORREGIDA
  // ============================================
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  const etiquetaX = 90;
  const espacioEtiquetaLinea = 10;
  const espacioLineaDato = 10;
  const textoYOffset = -8; // <-- NUEVO: desplazamiento hacia ARRIBA del texto

  // "Nombre y apellido:"
  ctx.fillText("Nombre y apellido:", etiquetaX, y);
  const anchoEtiqueta1 = ctx.measureText("Nombre y apellido:").width;
  const inicioLinea1 = etiquetaX + anchoEtiqueta1 + espacioEtiquetaLinea;
  drawLongDottedLine(ctx, inicioLinea1, y - 5, canvas.width - 50, y - 5);
  // El texto va 8px ARRIBA de la línea
  ctx.fillText(
    data.conductor_nombre || "",
    inicioLinea1 + espacioLineaDato,
    y + textoYOffset,
  );
  y += 35;

  // "Tipo y Nº de licencia:"
  ctx.fillText("Tipo y Nº de licencia:", etiquetaX, y);
  const anchoEtiqueta2 = ctx.measureText("Tipo y Nº de licencia:").width;
  const inicioLinea2 = etiquetaX + anchoEtiqueta2 + espacioEtiquetaLinea;
  drawLongDottedLine(ctx, inicioLinea2, y - 5, canvas.width - 50, y - 5);
  const licenciaTexto =
    `${data.licencia_tipo || ""} ${data.licencia_numero || ""}`.trim();
  // El texto va 8px ARRIBA de la línea
  ctx.fillText(
    licenciaTexto,
    inicioLinea2 + espacioLineaDato,
    y + textoYOffset,
  );
  y += 35;

  // "Vencimiento carnet:"
  ctx.fillText("Vencimiento carnet:", etiquetaX, y);
  const anchoEtiqueta3 = ctx.measureText("Vencimiento carnet:").width;
  const inicioLinea3 = etiquetaX + anchoEtiqueta3 + espacioEtiquetaLinea;
  drawLongDottedLine(ctx, inicioLinea3, y - 5, canvas.width - 50, y - 5);
  if (data.licencia_vencimiento) {
    const fechaVenc = new Date(data.licencia_vencimiento);
    const fechaFormateada = fechaVenc.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    // El texto va 8px ARRIBA de la línea
    ctx.fillText(
      fechaFormateada,
      inicioLinea3 + espacioLineaDato,
      y + textoYOffset,
    );
  }
}

// ============================================
// FUNCIONES AUXILIARES (IGUAL)
// ============================================

function drawShortLine(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = "#000000";
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawLongDottedLine(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = "#000000";
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}