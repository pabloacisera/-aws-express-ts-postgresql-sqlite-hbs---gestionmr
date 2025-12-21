// /api/controllers/PdfController.ts
import prisma from "../../config/prisma.client.js";
import { PdfService } from "../services/PdfService.js";
import { Request, Response } from "express";

export class PdfController {
  static async downloadRegistryPDF(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "ID de registro es requerido",
        });
      }

      // buscar registro
      const registro = await prisma.controlRegister.findFirst({
        where: { id: parseInt(id) },
      });

      if (!registro) {
        return res.status(404).json({
          success: false, // CORRECCIÓN: "success" no "sucsess"
          error: "Registro no encontrado.",
        });
      }

      const pdfBuffer = await PdfService.generateRegistryPDF(registro);

      const filename = `registro_control_${registro.id}_${new Date().toISOString().split("T")[0]}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      // CORRECCIÓN: Convertir a string o usar Buffer.byteLength
      res.setHeader("Content-Length", pdfBuffer.length.toString());
      // O también puedes usar:
      // res.setHeader("Content-Length", Buffer.byteLength(pdfBuffer).toString());

      // Enviar el PDF
      res.send(pdfBuffer);
    } catch (err) {
      console.error("Error generando PDF:", err);
      res.status(500).json({
        success: false,
        error: "Error interno al generar el PDF",
      });
    }
  }
}
