// CloudinaryDocService.ts
import prisma from "../../config/prisma.client.js";
import { UploadCertificate } from "../../dto/certificate.dto.js";
import { $Enums } from "@prisma/client";
import { uploadToCloudinary, deleteFromCloudinary } from "../../config/cloudinary.config.js";
import fs from 'fs';
import path from 'path';
import { cloudinaryCacheDocService } from "./CloudinaryCacheDocService.js";

export class CloudinaryDocService {
  public async uploadCertificate(file: Express.Multer.File, data: UploadCertificate) {
    try {
      console.log('📋 CloudinaryDocService.uploadCertificate - Iniciando...');
      console.log('📊 Datos recibidos:', {
        controlId: data.controlId,
        certificateType: data.certificateType,
        certificateNumber: data.certificateNumber,
        description: data.description,
        expirationDate: data.expirationDate
      });
      console.log('📄 Información del archivo:', {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path
      });

      // 1. Verificar que el control existe
      const controlFound = await prisma.controlRegister.findUnique({
        where: { id: data.controlId }
      });

      if (!controlFound) {
        throw new Error("Control no encontrado.");
      }

      // 2. Validar número de certificado
      this.validateCertificateNumber(controlFound, data.certificateType, data.certificateNumber);

      // 3. Subir archivo a Cloudinary
      console.log('☁️ Subiendo archivo a Cloudinary...');

      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const originalName = path.parse(file.originalname).name;
      const ext = path.extname(file.originalname);

      let resourceType: 'image' | 'raw' = 'raw';

      // Solo usar 'image' si es realmente una imagen
      if (file.mimetype.startsWith('image/')) {
        resourceType = 'image';
      }

      // ✅ CORRECCIÓN: Configurar correctamente las opciones para Cloudinary
      const cloudinaryOptions = {
        // 🔑 CLAVE: Anteponemos 'assets/'
        folder: `assets/certificates/control_${data.controlId}/${data.certificateType}`,
        public_id: `${data.certificateType}_${timestamp}_${random}`,
        resource_type: resourceType,
        type: 'upload'
      };

      console.log('🔧 Opciones de Cloudinary:', cloudinaryOptions);

      // Subir a Cloudinary
      const uploadResult: any = await uploadToCloudinary(file.path, cloudinaryOptions);

      console.log(`✅ Archivo subido a Cloudinary: ${uploadResult.secure_url}`);
      console.log(`📌 Public ID: ${uploadResult.public_id}`);

      // 🚨 Diagnóstico
      console.log('--- DIAGNÓSTICO CLOUDINARY ---');
      console.log(`URL Segura (filePath): ${uploadResult.secure_url}`);
      console.log(`ID Público: ${uploadResult.public_id}`);
      console.log('------------------------------');

      console.log(`✅ Archivo subido a Cloudinary: ${uploadResult.secure_url}`);

      // 4. Verificar si ya existe un documento para este tipo de certificado
      const existingDoc = await prisma.certificateDocument.findFirst({
        where: {
          controlId: data.controlId,
          certificateType: data.certificateType
        }
      });

      let certificateDoc;

      if (existingDoc) {
        console.log(`🔄 Actualizando documento existente ID: ${existingDoc.id}`);

        // Eliminar el archivo anterior de Cloudinary
        if (existingDoc.publicId) {
          try {
            await deleteFromCloudinary(existingDoc.publicId);
            console.log(`🗑️ Archivo anterior eliminado de Cloudinary: ${existingDoc.publicId}`);
          } catch (error) {
            console.error('Error eliminando archivo anterior de Cloudinary:', error);
          }
        }

        // Actualizar referencia del documento
        certificateDoc = await prisma.certificateDocument.update({
          where: { id: existingDoc.id },
          data: {
            controlId: data.controlId,
            certificateType: data.certificateType,
            certificateNumber: data.certificateNumber,
            fileName: file.originalname,
            filePath: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            fileSize: file.size,
            mimeType: file.mimetype,
            description: data.description ?? null,
            uploadedAt: new Date()
          }
        });

        console.log(`✅ Documento actualizado exitosamente: ID ${certificateDoc.id}`);

      } else {
        console.log('🆕 Creando nuevo documento...');

        certificateDoc = await prisma.certificateDocument.create({
          data: {
            controlId: data.controlId,
            certificateType: data.certificateType,
            certificateNumber: data.certificateNumber,
            fileName: file.originalname,
            filePath: uploadResult.secure_url, // <-- Usar la URL completa
            publicId: uploadResult.public_id,
            fileSize: file.size,
            mimeType: file.mimetype,
            description: data.description ?? null,
            uploadedAt: new Date()
          }
        });

        console.log(`✅ Nuevo documento creado exitosamente: ID ${certificateDoc.id}`);
      }

      if (data.expirationDate) {
        console.log(`📅 Actualizando fecha de vencimiento para ${data.certificateType}: ${data.expirationDate}`);

        const updateData: any = {}

        const dateFieldMap = {
          'C_MATRICULACION': 'c_matriculacion_venc',
          'SEGURO': 'seguro_venc',
          'RTO': 'rto_venc',
          'TACOGRAFO': 'tacografo_venc'
        }

        const dateField = dateFieldMap[data.certificateType];
        if(dateField) {
          updateData[dateField] = new Date(data.expirationDate);
          // actualizar postgres
          const updateControl = await prisma.controlRegister.update({
            where: { id: data.controlId },
            data: updateData
          });

          console.log(`✅ Fecha de vencimiento actualizada en PostgreSQL: ${dateField} = ${data.expirationDate}`);

          await cloudinaryCacheDocService.syncControlToSQLite(updateControl);
                console.log(`✅ Control actualizado sincronizado con SQLite cache`);
        }
      }

      // 🔄 Sincronizar certificado al caché SQLite
      await cloudinaryCacheDocService.syncCertificateToSQLite(certificateDoc);

      // 🔄 Sincronizar control al caché SQLite
      await cloudinaryCacheDocService.syncControlToSQLite(controlFound);

      // 5. Eliminar archivo temporal
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Archivo temporal eliminado: ${file.path}`);
      }

      // 6. Retornar resultado
      console.log('🎉 Subida completada exitosamente');
      return certificateDoc;

    } catch (error) {
      console.error('❌ Error en uploadCertificate:', error);

      // Limpiar archivo temporal si existe y hubo error
      if (file && file.path && fs.existsSync(file.path)) {
        console.log(`🗑️ Limpiando archivo temporal debido a error: ${file.path}`);
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error al eliminar archivo temporal:', unlinkError);
        }
      }

      throw error;
    }
  }

  private validateCertificateNumber(control: any, certificateType: string, certificateNumber: string) {
    console.log(`🔍 Validando certificado ${certificateType}: ${certificateNumber}`);

    let controlCertNumber: string | null = null;

    switch (certificateType) {
      case 'C_MATRICULACION':
        controlCertNumber = control.c_matriculacion_cert;
        break;
      case 'SEGURO':
        controlCertNumber = control.seguro_cert;
        break;
      case 'RTO':
        controlCertNumber = control.rto_cert;
        break;
      case 'TACOGRAFO':
        controlCertNumber = control.tacografo_cert;
        break;
      default:
        throw new Error("Tipo de certificado no válido");
    }

    if (!controlCertNumber) {
      throw new Error(`El control ${control.id} no tiene un número de certificado para ${certificateType}`);
    }

    if (controlCertNumber !== certificateNumber) {
      throw new Error(
        `Número de certificado no coincide. ` +
        `En el control: ${controlCertNumber}, ` +
        `Recibido: ${certificateNumber}`
      );
    }

    console.log(`✅ Certificado validado correctamente`);
    return true;
  }

  // certificate by id CON CACHÉ
  public async getCertificateById(id: number) {
    console.log(`🔍 Buscando certificado ${id}...`);

    // 1. Primero buscar en caché (SQLite)
    const cachedCert = await cloudinaryCacheDocService.getCertificateById(id);
    if (cachedCert) {
      return cachedCert;
    }

    console.log(`📭 Certificado ${id} no encontrado en caché, buscando en PostgreSQL...`);

    // 2. Si no está en caché, buscar en PostgreSQL
    const pgCert = await prisma.certificateDocument.findUnique({
      where: { id },
      include: {
        control: {
          select: {
            id: true,
            dominio: true,
            conductor_nombre: true,
            empresa_select: true
          }
        }
      }
    });

    if (pgCert) {
      console.log(`✅ Certificado ${id} encontrado en PostgreSQL, sincronizando a caché...`);

      // Sincronizar certificado a caché
      await cloudinaryCacheDocService.syncCertificateToSQLite(pgCert);

      // Si hay control, sincronizarlo también
      if (pgCert.control) {
        await cloudinaryCacheDocService.syncControlToSQLite(pgCert.control);
      }
    }

    return pgCert;
  }

  // certificate by type CON CACHÉ
  public async getCertificateByType(controlId: number, certificateType: $Enums.CertificateType) {
    console.log(`🔍 Buscando certificado ${certificateType} para control ${controlId}...`);

    // 1. Primero buscar en caché (SQLite)
    const cachedCert = await cloudinaryCacheDocService.getCertificateByType(controlId, certificateType);
    if (cachedCert) {
      return cachedCert;
    }

    console.log(`📭 Certificado no encontrado en caché, buscando en PostgreSQL...`);

    // 2. Si no está en caché, buscar en PostgreSQL
    const pgCert = await prisma.certificateDocument.findFirst({
      where: {
        controlId,
        certificateType
      }
    });

    if (pgCert) {
      console.log(`✅ Certificado encontrado en PostgreSQL, sincronizando a caché...`);
      await cloudinaryCacheDocService.syncCertificateToSQLite(pgCert);
    }

    return pgCert;
  }

  // all certificates by controlId CON CACHÉ
  public async getAllCertificatesById(controlId: number) {
    console.log(`🔍 Buscando todos certificados para control ${controlId}...`);

    // 1. Primero buscar en caché (SQLite)
    const cachedCerts = await cloudinaryCacheDocService.getAllCertificatesById(controlId);
    if (cachedCerts && cachedCerts.length > 0) {
      return cachedCerts;
    }

    console.log(`📭 No hay certificados en caché, buscando en PostgreSQL...`);

    // 2. Si no está en caché, buscar en PostgreSQL
    const pgCerts = await prisma.certificateDocument.findMany({
      where: { controlId },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    if (pgCerts.length > 0) {
      console.log(`✅ ${pgCerts.length} certificados encontrados en PostgreSQL, sincronizando a caché...`);
      // Sincronizar todos los certificados a caché
      for (const cert of pgCerts) {
        await cloudinaryCacheDocService.syncCertificateToSQLite(cert);
      }
    }

    return pgCerts;
  }

  // getCertificateStatus CON CACHÉ
  async getCertificateStatus(controlId: number) {
    console.log(`🔍 Buscando estado de certificados para control ${controlId}...`);

    // 1. Primero buscar en caché (SQLite)
    const cachedStatus = await cloudinaryCacheDocService.getCertificateStatus(controlId);
    if (cachedStatus) {
      return cachedStatus;
    }

    console.log(`📭 Estado no encontrado en caché, buscando en PostgreSQL...`);

    // 2. Si no está en caché, buscar en PostgreSQL
    const control = await prisma.controlRegister.findUnique({
      where: { id: controlId },
      include: {
        certificates: true
      }
    });

    if (!control) {
      throw new Error('Control no encontrado');
    }

    // Sincronizar control y certificados a caché
    console.log(`✅ Control ${controlId} encontrado en PostgreSQL, sincronizando a caché...`);
    await cloudinaryCacheDocService.syncControlToSQLite(control);

    for (const cert of control.certificates) {
      await cloudinaryCacheDocService.syncCertificateToSQLite(cert);
    }

    // Procesar estado
    const certificateTypes = [
      {
        type: 'C_MATRICULACION' as const,
        number: control.c_matriculacion_cert,
        label: 'Certificado de Matriculación',
        hasCertificate: !!control.c_matriculacion_cert
      },
      {
        type: 'SEGURO' as const,
        number: control.seguro_cert,
        label: 'Certificado de Seguro',
        hasCertificate: !!control.seguro_cert
      },
      {
        type: 'RTO' as const,
        number: control.rto_cert,
        label: 'Certificado RTO',
        hasCertificate: !!control.rto_cert
      },
      {
        type: 'TACOGRAFO' as const,
        number: control.tacografo_cert,
        label: 'Certificado de Tacógrafo',
        hasCertificate: !!control.tacografo_cert
      }
    ];

    const status = certificateTypes.map(certType => {
      const uploadedDoc = control.certificates.find(
        doc => doc.certificateType === certType.type
      );

      return {
        type: certType.type,
        label: certType.label,
        certificateNumber: certType.number,
        hasCertificate: certType.hasCertificate,
        hasDocument: !!uploadedDoc,
        document: uploadedDoc ? {
          id: uploadedDoc.id,
          fileName: uploadedDoc.fileName,
          uploadedAt: uploadedDoc.uploadedAt,
          mimeType: uploadedDoc.mimeType,
          description: uploadedDoc.description
        } : null,
        canUpload: certType.hasCertificate && !uploadedDoc,
        canUpdate: certType.hasCertificate && !!uploadedDoc
      };
    });

    return status;
  }

  // deleteCertificate CON CACHÉ
  async deleteCertificate(id: number) {
    const doc = await prisma.certificateDocument.findUnique({
      where: { id }
    });

    if (!doc) {
      throw new Error('Documento no encontrado');
    }

    // Eliminar archivo de Cloudinary
    if (doc.publicId) {
      try {
        await deleteFromCloudinary(doc.publicId);
        console.log(`🗑️ Archivo eliminado de Cloudinary: ${doc.publicId}`);
      } catch (error) {
        console.error('Error eliminando archivo de Cloudinary:', error);
      }
    }

    // Eliminar de la base de datos
    const result = await prisma.certificateDocument.delete({
      where: { id }
    });

    // Eliminar del caché SQLite
    await cloudinaryCacheDocService.deleteCertificateFromCache(id);

    return result;
  }

  // deleteCertificateByType CON CACHÉ
  async deleteCertificateByType(controlId: number, certificateType: $Enums.CertificateType) {
    const doc = await prisma.certificateDocument.findFirst({
      where: {
        controlId,
        certificateType
      }
    });

    if (!doc) {
      throw new Error('Documento no encontrado');
    }

    // Eliminar archivo de Cloudinary
    if (doc.publicId) {
      try {
        await deleteFromCloudinary(doc.publicId);
        console.log(`🗑️ Archivo eliminado de Cloudinary: ${doc.publicId}`);
      } catch (error) {
        console.error('Error eliminando archivo de Cloudinary:', error);
      }
    }

    // Eliminar de la base de datos
    const result = await prisma.certificateDocument.delete({
      where: { id: doc.id }
    });

    // Eliminar del caché SQLite
    await cloudinaryCacheDocService.deleteCertificateByTypeFromCache(controlId, certificateType);

    return result;
  }

  async getFileStream(filePath: string) {
    // Para Cloudinary, no podemos devolver un stream directamente
    // En su lugar, redirigiremos a la URL de Cloudinary
    throw new Error('Para Cloudinary, use la URL del archivo');
  }

  async getFileBuffer(filePath: string) {
    // Para Cloudinary, no podemos obtener el buffer directamente
    throw new Error('Para Cloudinary, use la URL del archivo');
  }

  // Nuevo método para obtener URL de Cloudinary
  async getFileUrl(publicId: string, options = {}) {
    const { v2: cloudinary } = await import('cloudinary');
    return cloudinary.url(publicId, {
      secure: true,
      ...options
    });
  }
}

export const cloudinaryDocService = new CloudinaryDocService();