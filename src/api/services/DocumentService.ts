import fs from "fs";
import path from "path";
import prisma from "../../config/prisma.client.js";
import { UploadCertificate } from "../../dto/certificate.dto.js";
import { $Enums } from "@prisma/client";
import { moveTempFileToDestination } from "../../config/multer.config.js";

export class DocumentService {
  public async uploadCertificate(
    file: Express.Multer.File,
    data: UploadCertificate,
  ) {
    try {
      console.log("📋 DocumentService.uploadCertificate - Iniciando...");
      console.log("📊 Datos recibidos:", data);
      console.log("📄 Información del archivo:", {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
      });

      // 1. Verificar que el control existe
      const controlFound = await prisma.controlRegister.findUnique({
        where: { id: data.controlId, isDeleted: false },
      });

      if (!controlFound) {
        throw new Error("Control no encontrado.");
      }

      // 2. Validar número de certificado
      this.validateCertificateNumber(
        controlFound,
        data.certificateType,
        data.certificateNumber,
      );

      // 3. Mover archivo del directorio temporal al definitivo
      console.log("📁 Moviendo archivo temporal al directorio definitivo...");
      const finalPath = moveTempFileToDestination(
        file.path,
        data.controlId,
        data.certificateType,
        file.originalname,
      );

      // 4. Verificar si ya existe un documento para este tipo de certificado
      const existingDoc = await prisma.certificateDocument.findFirst({
        where: {
          controlId: data.controlId,
          certificateType: data.certificateType,
        },
      });

      let certificateDoc;

      if (existingDoc) {
        console.log(
          `🔄 Actualizando documento existente ID: ${existingDoc.id}`,
        );

        // Eliminar el archivo anterior
        if (fs.existsSync(existingDoc.filePath)) {
          console.log(
            `🗑️ Eliminando archivo anterior: ${existingDoc.filePath}`,
          );
          fs.unlinkSync(existingDoc.filePath);
        }

        // Actualizar referencia del documento
        certificateDoc = await prisma.certificateDocument.update({
          where: { id: existingDoc.id },
          data: {
            controlId: data.controlId,
            certificateType: data.certificateType,
            certificateNumber: data.certificateNumber,
            fileName: file.originalname,
            filePath: finalPath,
            fileSize: file.size,
            mimeType: file.mimetype,
            description: data.description ?? null,
            uploadedAt: new Date(),
          },
        });

        console.log(
          `✅ Documento actualizado exitosamente: ID ${certificateDoc.id}`,
        );
      } else {
        console.log("🆕 Creando nuevo documento...");

        // Crear nuevo documento
        certificateDoc = await prisma.certificateDocument.create({
          data: {
            controlId: data.controlId,
            certificateType: data.certificateType,
            certificateNumber: data.certificateNumber,
            fileName: file.originalname,
            filePath: finalPath,
            fileSize: file.size,
            mimeType: file.mimetype,
            description: data.description ?? null,
            uploadedAt: new Date(),
          },
        });

        console.log(
          `✅ Nuevo documento creado exitosamente: ID ${certificateDoc.id}`,
        );
      }

      if (data.expirationDate) {
        console.log(
          `📅 Actualizando fecha de vencimiento para ${data.certificateType}: ${data.expirationDate}`,
        );

        const updateData: any = {};
        const dateFieldMap = {
          C_MATRICULACION: "c_matriculacion_venc",
          SEGURO: "seguro_venc",
          RTO: "rto_venc",
          TACOGRAFO: "tacografo_venc",
        };

        const dateField = dateFieldMap[data.certificateType];

        if (dateField) {
          updateData[dateField] = new Date(data.expirationDate);

          // Actualizar en PostgreSQL
          await prisma.controlRegister.update({
            where: { id: data.controlId },
            data: updateData,
          });

          console.log(
            `✅ Fecha de vencimiento actualizada: ${dateField} = ${data.expirationDate}`,
          );
        }
      } else {
        console.log(
          `ℹ️  No se proporcionó fecha de vencimiento (primera carga)`,
        );
      }

      console.log("🎉 Subida completada exitosamente");
      return certificateDoc;
    } catch (error) {
      console.error("❌ Error en uploadCertificate:", error);

      // Limpiar archivo temporal si existe y hubo error
      if (file && file.path && fs.existsSync(file.path)) {
        console.log(
          `🗑️ Limpiando archivo temporal debido a error: ${file.path}`,
        );
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error("Error al eliminar archivo temporal:", unlinkError);
        }
      }

      throw error;
    }
  }

  private validateCertificateNumber(
    control: any,
    certificateType: string,
    certificateNumber: string,
  ) {
    console.log(
      `🔍 Validando certificado ${certificateType}: ${certificateNumber}`,
    );

    let controlCertNumber: string | null = null;

    switch (certificateType) {
      case "C_MATRICULACION":
        controlCertNumber = control.c_matriculacion_cert;
        break;
      case "SEGURO":
        controlCertNumber = control.seguro_cert;
        break;
      case "RTO":
        controlCertNumber = control.rto_cert;
        break;
      case "TACOGRAFO":
        controlCertNumber = control.tacografo_cert;
        break;
      default:
        throw new Error("Tipo de certificado no válido");
    }

    if (!controlCertNumber) {
      throw new Error(
        `El control ${control.id} no tiene un número de certificado para ${certificateType}`,
      );
    }

    if (controlCertNumber !== certificateNumber) {
      throw new Error(
        `Número de certificado no coincide. ` +
          `En el control: ${controlCertNumber}, ` +
          `Recibido: ${certificateNumber}`,
      );
    }

    console.log(`✅ Certificado validado correctamente`);
    return true;
  }

  // ========== OBTENER CERTIFICADO POR ID ==========
  public async getCertificateById(id: number) {
    try {
      console.log(`🔍 Buscando certificado ${id} en PostgreSQL...`);

      const certificate = await prisma.certificateDocument.findUnique({
        where: { id },
        include: {
          control: {
            select: {
              id: true,
              dominio: true,
              conductor_nombre: true,
              empresa_select: true,
            },
          },
        },
      });

      if (!certificate) {
        throw new Error("Certificado no encontrado");
      }

      console.log(`✅ Certificado ${id} encontrado`);
      return certificate;
    } catch (error) {
      console.error("Error al obtener certificado por ID:", error);
      throw new Error("No se pudo obtener el certificado");
    }
  }

  // ========== OBTENER CERTIFICADO POR TIPO ==========
  public async getCertificateByType(
    controlId: number,
    certificateType: $Enums.CertificateType,
  ) {
    try {
      console.log(
        `🔍 Buscando certificado ${certificateType} para control ${controlId}...`,
      );

      const certificate = await prisma.certificateDocument.findFirst({
        where: {
          controlId,
          certificateType,
        },
      });

      return certificate;
    } catch (error) {
      console.error("Error al obtener certificado por tipo:", error);
      throw error;
    }
  }

  // ========== OBTENER TODOS LOS CERTIFICADOS ==========
  public async getAllCertificatesById(controlId: number) {
    try {
      console.log(`🔍 Buscando certificados del control ${controlId}...`);

      const certificates = await prisma.certificateDocument.findMany({
        where: { controlId },
        orderBy: {
          uploadedAt: "desc",
        },
      });

      console.log(`✅ ${certificates.length} certificados encontrados`);
      return certificates;
    } catch (error) {
      console.error("Error al obtener certificados:", error);
      throw error;
    }
  }

  // ========== OBTENER ESTADO DE CERTIFICADOS ==========
  async getCertificateStatus(controlId: number) {
    try {
      console.log(
        `🔍 Buscando estado de certificados para control ${controlId}...`,
      );

      const control = await prisma.controlRegister.findUnique({
        where: { id: controlId },
        include: {
          certificates: true,
        },
      });

      if (!control) {
        throw new Error("Control no encontrado");
      }

      // Mapear todos los tipos de certificados posibles
      const certificateTypes = [
        {
          type: "C_MATRICULACION" as const,
          number: control.c_matriculacion_cert,
          label: "Certificado de Matriculación",
          hasCertificate: !!control.c_matriculacion_cert,
        },
        {
          type: "SEGURO" as const,
          number: control.seguro_cert,
          label: "Certificado de Seguro",
          hasCertificate: !!control.seguro_cert,
        },
        {
          type: "RTO" as const,
          number: control.rto_cert,
          label: "Certificado RTO",
          hasCertificate: !!control.rto_cert,
        },
        {
          type: "TACOGRAFO" as const,
          number: control.tacografo_cert,
          label: "Certificado de Tacógrafo",
          hasCertificate: !!control.tacografo_cert,
        },
      ];

      // Para cada tipo, verificar si tiene documento subido
      const status = certificateTypes.map((certType) => {
        const uploadedDoc = control.certificates.find(
          (doc) => doc.certificateType === certType.type,
        );

        return {
          type: certType.type,
          label: certType.label,
          certificateNumber: certType.number,
          hasCertificate: certType.hasCertificate,
          hasDocument: !!uploadedDoc,
          document: uploadedDoc
            ? {
                id: uploadedDoc.id,
                fileName: uploadedDoc.fileName,
                uploadedAt: uploadedDoc.uploadedAt,
                mimeType: uploadedDoc.mimeType,
                description: uploadedDoc.description,
              }
            : null,
          canUpload: certType.hasCertificate && !uploadedDoc,
          canUpdate: certType.hasCertificate && !!uploadedDoc,
        };
      });

      return status;
    } catch (error) {
      console.error("Error obteniendo estado de certificados:", error);
      throw error;
    }
  }

  // ========== ELIMINAR CERTIFICADO ==========
  async deleteCertificate(id: number) {
    try {
      console.log(`🗑️ Eliminando certificado ${id}...`);

      // 1. Obtener documento primero
      const doc = await prisma.certificateDocument.findUnique({
        where: { id, isDeleted: false },
      });

      if (!doc) {
        throw new Error("Documento no encontrado");
      }

      // 2. Eliminar archivo físico
      if (fs.existsSync(doc.filePath)) {
        console.log(`🗑️ Eliminando archivo físico: ${doc.filePath}`);
        fs.unlinkSync(doc.filePath);
      }

      // 3. Eliminar de PostgreSQL
      const deletedDoc = await prisma.certificateDocument.delete({
        where: { id },
      });

      console.log(`✅ Certificado ${id} eliminado`);
      return deletedDoc;
    } catch (error) {
      console.error("Error al eliminar certificado:", error);
      throw error;
    }
  }

  async deleteCertificateByType(
    controlId: number,
    certificateType: $Enums.CertificateType,
  ) {
    try {
      console.log(
        `🗑️ Eliminando certificado ${certificateType} del control ${controlId}...`,
      );

      // 1. Buscar documento
      const doc = await prisma.certificateDocument.findFirst({
        where: {
          controlId,
          certificateType,
        },
      });

      if (!doc) {
        throw new Error("Documento no encontrado");
      }

      // 2. Eliminar archivo físico
      if (fs.existsSync(doc.filePath)) {
        console.log(`🗑️ Eliminando archivo físico: ${doc.filePath}`);
        fs.unlinkSync(doc.filePath);
      }

      // 3. Eliminar de PostgreSQL
      const deletedDoc = await prisma.certificateDocument.delete({
        where: { id: doc.id },
      });

      console.log(`✅ Certificado eliminado`);
      return deletedDoc;
    } catch (error) {
      console.error("Error al eliminar certificado:", error);
      throw error;
    }
  }

  async getFileStream(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error("Archivo no encontrado");
    }

    return fs.createReadStream(filePath);
  }

  async getFileBuffer(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error("Archivo no encontrado");
    }

    return fs.readFileSync(filePath);
  }

  // ========== MÉTODO PARA BUSCAR CERTIFICADOS ==========
  public async searchCertificates(
    searchTerm: string = "",
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    try {
      console.log(`🔍 Buscando certificados "${searchTerm}"...`);

      const skip = (page - 1) * limit;

      let whereCondition: any = {};
      if (searchTerm.trim()) {
        whereCondition = {
          isDeleted: false,
          OR: [
            {
              certificateNumber: { contains: searchTerm, mode: "insensitive" },
            },
            { fileName: { contains: searchTerm, mode: "insensitive" } },
            { description: { contains: searchTerm, mode: "insensitive" } },
          ],
        };
      }

      const totalRecords = await prisma.certificateDocument.count({
        where: whereCondition,
      });

      const certificates = await prisma.certificateDocument.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          control: {
            select: {
              id: true,
              dominio: true,
              conductor_nombre: true,
              empresa_select: true,
            },
          },
        },
        orderBy: {
          uploadedAt: "desc",
        },
      });

      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      const result = {
        data: certificates,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
      };

      return result;
    } catch (error) {
      console.error("Error buscando certificados:", error);
      throw error;
    }
  }
}

export const documentService = new DocumentService();
