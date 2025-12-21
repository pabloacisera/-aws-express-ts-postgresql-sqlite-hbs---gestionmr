// /api/services/PdfService.ts - VERSIÓN CON RUTA CORRECTA
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PdfService {
  static async generateRegistryPDF(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "letter",
          margins: { top: 20, bottom: 30, left: 40, right: 40 },
        });

        const buffers: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => buffers.push(chunk));
        doc.on("end", () => {
          resolve(Buffer.concat(buffers));
        });

        let y = 30;

        // ============================================
        // 1. HEADER CON IMAGEN - RUTA CORREGIDA
        // ============================================

        // CORRECCIÓN: Ir DOS niveles arriba desde /api/services/ para llegar a la raíz
        const projectRoot = path.join(__dirname, "../../.."); // <-- CAMBIADO
        console.log("📁 Project Root:", projectRoot);

        // Ruta correcta: proyecto/public/images/
        const imagePath = path.join(
          projectRoot,
          "public/images/nuevo_header.png",
        );
        console.log("📁 Ruta de imagen corregida:", imagePath);
        console.log("📁 ¿Existe la imagen?:", fs.existsSync(imagePath));

        if (fs.existsSync(imagePath)) {
          console.log("✅ Imagen encontrada, cargando...");

          try {
            // Cargar la imagen
            doc.image(imagePath, 40, 15, {
              width: 532,
              //height: 100,
              fit: [532, 150],
            });
            console.log("✅ Imagen cargada exitosamente");
            y = 165;
          } catch (imageError: any) {
            console.log("⚠️ Error cargando imagen:", imageError.message);
            drawTextHeader(doc);
            y = 60;
          }
        } else {
          console.log("❌ Imagen no encontrada, usando texto");
          drawTextHeader(doc);
          y = 60;
        }

        doc.y = y;

        // ============================================
        // 2. ANEXO II
        // ============================================
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("ANEXO II", { align: "center" });

        y += 25;
        doc.y = y;

        // ============================================
        // 3. CUADRO DE DATOS
        // ============================================
        const boxWidth = 532;
        const boxHeight = 100;
        const boxX = 40;

        // Dibujar rectángulo
        doc.rect(boxX, y, boxWidth, boxHeight).stroke();

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
            hour12: false,
          });

          doc
            .fontSize(10)
            .font("Helvetica")
            .text(`Fecha: ${fechaTexto}`, boxX + 15, colY);
          colY += 22;
          doc.text(`Hora: ${horaTexto}`, boxX + 15, colY);
          colY += 22;
        }
        doc.text(`Lugar: ${data.lugar || ""}`, boxX + 15, colY);

        // Columna derecha
        colY = y + 25;
        const rightX = boxX + boxWidth / 2 + 10;
        doc.text(`Empresa: ${data.empresa_select || ""}`, rightX, colY);
        colY += 22;
        doc.text(`Dominio: ${data.dominio || ""}`, rightX, colY);
        colY += 22;
        doc.text(`Interno: ${data.interno || ""}`, rightX, colY);

        y += boxHeight + 35;
        doc.y = y;

        // ============================================
        // 4. SERVICIO
        // ============================================
        doc.fontSize(14).font("Helvetica-Bold");
        const servicioWidth = doc.widthOfString("SERVICIO:");

        // Calcula posición X centrada
        const servicioX = 40 + (532 - servicioWidth) / 2;

        // Dibuja el texto
        doc.text("SERVICIO:", servicioX, y);

        y += 30;
        doc.y = y;

        // Opciones en línea
        const opciones = [
          { text: "Regular", x: boxX + 50 },
          { text: "Sin fines de lucro", x: boxX + 200 },
          { text: "A demanda", x: boxX + 380 },
        ];

        doc.fontSize(11).font("Helvetica");

        opciones.forEach((opcion) => {
          doc.text(opcion.text, opcion.x, y);
          // Línea corta
          const lineX = opcion.x + doc.widthOfString(opcion.text) + 10;
          drawShortLine(doc, lineX, y + 6, lineX + 60, y + 6);
        });

        y += 40;
        doc.y = y;

        // ============================================
        // 5. TABLA DE SERVICIOS
        // ============================================
        //doc.fontSize(13).font("Helvetica-Bold").text("SERVICIOS:", boxX, y);
        y += 10;

        // Encabezados
        const headers = [
          { text: "SÍ", x: boxX + 180, width: 30 },
          { text: "NO", x: boxX + 220, width: 30 },
          { text: "Vencimiento", x: boxX + 280, width: 90 },
          { text: "N° Planilla", x: boxX + 400, width: 80 },
        ];

        doc.fontSize(10).font("Helvetica-Bold");
        headers.forEach((header) => {
          doc.text(header.text, header.x, y, {
            width: header.width,
            align: "center",
          });
        });

        // Línea debajo de encabezados
        doc
          .moveTo(boxX, y + 12)
          .lineTo(boxX + boxWidth, y + 12)
          .stroke();

        y += 22;
        doc.y = y;

        // Servicios
        const servicios = [
          { nombre: "G. Matriculación", campo: "c_matriculacion" },
          { nombre: "Seguro", campo: "seguro" },
          { nombre: "R.T.O", campo: "rto" },
          { nombre: "Tacógrafo", campo: "tacografo" },
        ];

        doc.fontSize(10).font("Helvetica");

        servicios.forEach((servicio, index) => {
          const tiene = data[`${servicio.campo}_cert`] ? true : false;
          const vencimiento = data[`${servicio.campo}_venc`];
          const planilla = data[`${servicio.campo}_cert`];

          // Nombre
          doc.text(servicio.nombre, boxX, y);

          // Check SÍ
          const siX = boxX + 195;
          if (tiene) {
            doc.circle(siX, y - 2, 3).fill();
          } else {
            doc.circle(siX, y - 2, 3).stroke();
          }

          // Check NO
          const noX = boxX + 235;
          if (!tiene) {
            doc.circle(noX, y - 2, 3).fill();
          } else {
            doc.circle(noX, y - 2, 3).stroke();
          }

          // Vencimiento
          if (vencimiento) {
            try {
              const fecha = new Date(vencimiento);
              const fechaTexto = fecha.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });
              doc.text(fechaTexto, boxX + 325, y, {
                width: 90,
                align: "center",
              });
            } catch (e) {
              // Ignorar error de fecha
            }
          }

          // Planilla
          if (planilla) {
            doc.text(planilla.toString(), boxX + 440, y, {
              width: 80,
              align: "center",
            });
          }

          y += 25;
          doc.y = y;
        });

        y += 30;

        // ============================================
        // 6. LÍNEA SEPARADORA
        // ============================================
        doc
          .moveTo(boxX, y)
          .lineTo(boxX + boxWidth, y)
          .dash(5, { space: 5 })
          .stroke()
          .undash();

        y += 40;
        doc.y = y;

        // ============================================
        // 7. CONDUCTOR
        // ============================================
        doc.fontSize(15).font("Helvetica-Bold").text("CONDUCTOR", boxX, y);
        y += 35;

        doc.fontSize(11).font("Helvetica");

        // Función para línea con guiones
        const drawConductorLine = (label: string, value: string) => {
          doc.text(`${label}:`, boxX, y);
          const labelWidth = doc.widthOfString(`${label}:`);

          // Guiones y valor
          const guionX = boxX + labelWidth + 10;
          doc.text("--", guionX, y);

          if (value) {
            const valueX = guionX + doc.widthOfString("-- ") + 5;
            doc.text(value, valueX, y);

            const finalGuionX = valueX + doc.widthOfString(value) + 10;
            doc.text("--", finalGuionX, y);
          } else {
            const finalGuionX = guionX + doc.widthOfString("--") + 50;
            doc.text("--", finalGuionX, y);
          }

          y += 28;
        };

        drawConductorLine("Nombre y apellido", data.conductor_nombre || "");

        const licenciaTexto =
          `${data.licencia_tipo || ""} ${data.licencia_numero || ""}`.trim();
        drawConductorLine("Tipo y Nº de licencia", licenciaTexto);

        if (data.licencia_vencimiento) {
          try {
            const fecha = new Date(data.licencia_vencimiento);
            const fechaTexto = fecha.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            drawConductorLine("Vencimiento carnet", fechaTexto);
          } catch (e) {
            drawConductorLine("Vencimiento carnet", "");
          }
        } else {
          drawConductorLine("Vencimiento carnet", "");
        }

        // ============================================
        // 8. PIE DE PÁGINA
        // ============================================
        const today = new Date().toLocaleDateString("es-ES");
        doc
          .fontSize(9)
          .fillColor("#666666")
          .text(`Generado el: ${today}`, boxX, 750, {
            align: "right",
            width: boxWidth,
          });

        // Finalizar
        doc.end();
      } catch (error) {
        console.error("❌ Error generando PDF:", error);
        reject(error);
      }
    });
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function drawTextHeader(doc: PDFKit.PDFDocument) {
  // Fondo gris
  doc.rect(40, 15, 532, 40).fill("#f0f0f0");

  // Texto centrado
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("REGISTRO DE CONTROL VEHICULAR", 40, 25, {
      width: 532,
      align: "center",
    });

  doc
    .fontSize(12)
    .font("Helvetica")
    .text("ANEXO II - FORMULARIO OFICIAL", 40, 45, {
      width: 532,
      align: "center",
    });
}

function drawShortLine(
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  doc
    .save()
    .moveTo(x1, y1)
    .lineTo(x2, y2)
    .strokeColor("#000000")
    .lineWidth(0.5)
    .stroke()
    .restore();
}
