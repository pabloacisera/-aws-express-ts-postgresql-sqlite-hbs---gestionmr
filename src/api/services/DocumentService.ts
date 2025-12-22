import fs from "fs";
import path from "path";
import prisma from "../../config/prisma.client.js";
import { UploadCertificate } from "../../dto/certificate.dto.js";
import { $Enums } from "@prisma/client";
import { moveTempFileToDestination } from "../../config/multer.config.js";
import { DocumentCacheService } from "./DocumentCacheService.js"; // Importar el cache service

export class DocumentService {
    public async uploadCertificate(file: Express.Multer.File, data: UploadCertificate) {
        try {
            console.log('📋 DocumentService.uploadCertificate - Iniciando...');
            console.log('📊 Datos recibidos:', data);
            console.log('📄 Información del archivo:', {
                originalname: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                path: file.path
            });

            // 1. Verificar que el control existe
            const controlFound = await prisma.controlRegister.findUnique({
                where: { id: data.controlId, isDeleted: false }
            });

            if (!controlFound) {
                throw new Error("Control no encontrado.");
            }

            // 2. Validar número de certificado
            this.validateCertificateNumber(controlFound, data.certificateType, data.certificateNumber);

            // 3. Mover archivo del directorio temporal al definitivo
            console.log('📁 Moviendo archivo temporal al directorio definitivo...');
            const finalPath = moveTempFileToDestination(
                file.path,
                data.controlId,
                data.certificateType,
                file.originalname
            );

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

                // Eliminar el archivo anterior
                if (fs.existsSync(existingDoc.filePath)) {
                    console.log(`🗑️ Eliminando archivo anterior: ${existingDoc.filePath}`);
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
                        uploadedAt: new Date()
                    }
                });

                console.log(`✅ Documento actualizado exitosamente: ID ${certificateDoc.id}`);

            } else {
                console.log('🆕 Creando nuevo documento...');

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
                        uploadedAt: new Date()
                    }
                });

                console.log(`✅ Nuevo documento creado exitosamente: ID ${certificateDoc.id}`);
            }

            // 5. SINCRONIZAR CON CACHE
            try {
                console.log(`🔄 Sincronizando certificado ${certificateDoc.id} a cache...`);
                await DocumentCacheService.syncCertificateFromPostgres(certificateDoc);
                console.log(`✅ Certificado sincronizado a cache`);
            } catch (cacheError) {
                console.error("⚠️ Error al sincronizar con cache (continuando):", cacheError);
                // No fallamos la operación principal si el cache falla
            }

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

    // ========== OBTENER CERTIFICADO POR ID CON CACHE ==========
    public async getCertificateById(id: number) {
        try {
            // PRIMERO: Buscar en cache
            console.log(`🔍 Buscando certificado ${id} en cache...`);
            const cachedCert = await DocumentCacheService.getCertificateById(id);

            if (cachedCert) {
                console.log(`✅ Certificado ${id} encontrado en cache`);
                // Convertir string a Date para consistencia
                if (cachedCert.uploadedAt && typeof cachedCert.uploadedAt === 'string') {
                    cachedCert.uploadedAt = new Date(cachedCert.uploadedAt);
                }
                return cachedCert;
            }

            // SI NO EXISTE EN CACHE: Consultar PostgreSQL
            console.log(`📦 Certificado ${id} no en cache, consultando PostgreSQL...`);
            const certificate = await prisma.certificateDocument.findUnique({
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

            if (!certificate) {
                throw new Error("Certificado no encontrado");
            }

            // GUARDAR EN CACHE para futuras consultas
            this.syncToCache(certificate).catch(err =>
                console.error(`Error guardando certificado ${id} en cache:`, err)
            );

            return certificate;

        } catch (error) {
            console.error("Error al obtener certificado por ID:", error);
            throw new Error("No se pudo obtener el certificado");
        }
    }

    // ========== OBTENER CERTIFICADO POR TIPO CON CACHE ==========
    public async getCertificateByType(controlId: number, certificateType: $Enums.CertificateType) {
        try {
            // PRIMERO: Cache
            console.log(`🔍 Buscando certificado ${certificateType} para control ${controlId} en cache...`);
            const cachedCert = await DocumentCacheService.getCertificateByType(controlId, certificateType);

            if (cachedCert) {
                console.log(`✅ Certificado encontrado en cache`);
                if (cachedCert.uploadedAt && typeof cachedCert.uploadedAt === 'string') {
                    cachedCert.uploadedAt = new Date(cachedCert.uploadedAt);
                }
                return cachedCert;
            }

            // SI NO: PostgreSQL
            console.log(`📦 No en cache, consultando PostgreSQL...`);
            const certificate = await prisma.certificateDocument.findFirst({
                where: {
                    controlId,
                    certificateType
                }
            });

            // GUARDAR EN CACHE si existe
            if (certificate) {
                this.syncToCache(certificate).catch(err =>
                    console.error(`Error guardando certificado en cache:`, err)
                );
            }

            return certificate;

        } catch (error) {
            console.error("Error al obtener certificado por tipo:", error);
            throw error;
        }
    }

    // ========== OBTENER TODOS LOS CERTIFICADOS CON CACHE ==========
    public async getAllCertificatesById(controlId: number) {
        try {
            // ESTRATEGIA CACHE-FIRST para listados
            console.log(`🔍 Buscando certificados del control ${controlId} en cache...`);
            const cachedCerts = await DocumentCacheService.getAllCertificatesByControlId(controlId);

            if (cachedCerts && cachedCerts.length > 0) {
                console.log(`✅ ${cachedCerts.length} certificados encontrados en cache`);
                // Convertir fechas string a Date
                return cachedCerts.map(cert => ({
                    ...cert,
                    uploadedAt: cert.uploadedAt ? new Date(cert.uploadedAt) : new Date()
                }));
            }

            // SI NO HAY EN CACHE: PostgreSQL
            console.log(`📦 Cache vacío, consultando PostgreSQL...`);
            const certificates = await prisma.certificateDocument.findMany({
                where: { controlId },
                orderBy: {
                    uploadedAt: 'desc'
                }
            });

            // SINCRONIZAR CON CACHE
            this.syncMultipleToCache(certificates).catch(err =>
                console.error("Error sincronizando certificados a cache:", err)
            );

            return certificates;

        } catch (error) {
            console.error("Error al obtener certificados:", error);
            throw error;
        }
    }

    // ========== OBTENER ESTADO DE CERTIFICADOS CON CACHE ==========
    async getCertificateStatus(controlId: number) {
        try {
            // PRIMERO: Cache
            console.log(`🔍 Buscando estado de certificados ${controlId} en cache...`);
            const cachedStatus = await DocumentCacheService.getCertificateStatus(controlId);

            if (cachedStatus !== null) {
                console.log(`✅ Estado de certificados encontrado en cache`);
                return cachedStatus;
            }

            // SI NO: PostgreSQL
            console.log(`📦 No en cache, consultando PostgreSQL...`);
            const control = await prisma.controlRegister.findUnique({
                where: { id: controlId },
                include: {
                    certificates: true
                }
            });

            if (!control) {
                throw new Error('Control no encontrado');
            }

            // Mapear todos los tipos de certificados posibles
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

            // Para cada tipo, verificar si tiene documento subido
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

            // GUARDAR EN CACHE
            this.syncControlAndCertsToCache(control).catch(err =>
                console.error(`Error guardando estado en cache:`, err)
            );

            return status;

        } catch (error) {
            console.error("Error obteniendo estado de certificados:", error);
            throw error;
        }
    }

    // ========== ELIMINAR CERTIFICADO CON SINCRONIZACIÓN ==========
    async deleteCertificate(id: number) {
        try {
            console.log(`🗑️ Eliminando certificado ${id}...`);

            // 1. Obtener documento primero
            const doc = await prisma.certificateDocument.findUnique({
                where: { id, isDeleted: false }
            });

            if (!doc) {
                throw new Error('Documento no encontrado');
            }

            // 2. Eliminar archivo físico
            if (fs.existsSync(doc.filePath)) {
                console.log(`🗑️ Eliminando archivo físico: ${doc.filePath}`);
                fs.unlinkSync(doc.filePath);
            }

            // 3. Eliminar de PostgreSQL
            const deletedDoc = await prisma.certificateDocument.delete({
                where: { id }
            });

            console.log(`✅ Certificado ${id} eliminado de PostgreSQL`);

            // 4. Eliminar del cache
            try {
                const cacheDeleted = await DocumentCacheService.deleteCertificate(id);
                console.log(cacheDeleted ?
                    `✅ Eliminado de cache` :
                    `⚠️ No existía en cache`
                );
            } catch (cacheError) {
                console.error("⚠️ Error al eliminar de cache (continuando):", cacheError);
            }

            return deletedDoc;

        } catch (error) {
            console.error("Error al eliminar certificado:", error);
            throw error;
        }
    }

    async deleteCertificateByType(controlId: number, certificateType: $Enums.CertificateType) {
        try {
            console.log(`🗑️ Eliminando certificado ${certificateType} del control ${controlId}...`);

            // 1. Buscar documento
            const doc = await prisma.certificateDocument.findFirst({
                where: {
                    controlId,
                    certificateType
                }
            });

            if (!doc) {
                throw new Error('Documento no encontrado');
            }

            // 2. Eliminar archivo físico
            if (fs.existsSync(doc.filePath)) {
                console.log(`🗑️ Eliminando archivo físico: ${doc.filePath}`);
                fs.unlinkSync(doc.filePath);
            }

            // 3. Eliminar de PostgreSQL
            const deletedDoc = await prisma.certificateDocument.delete({
                where: { id: doc.id }
            });

            console.log(`✅ Certificado eliminado de PostgreSQL`);

            // 4. Eliminar del cache
            try {
                const cacheDeleted = await DocumentCacheService.deleteCertificateByType(controlId, certificateType);
                console.log(cacheDeleted ?
                    `✅ Eliminado de cache` :
                    `⚠️ No existía en cache`
                );
            } catch (cacheError) {
                console.error("⚠️ Error al eliminar de cache (continuando):", cacheError);
            }

            return deletedDoc;

        } catch (error) {
            console.error("Error al eliminar certificado:", error);
            throw error;
        }
    }

    async getFileStream(filePath: string) {
        if (!fs.existsSync(filePath)) {
            throw new Error('Archivo no encontrado');
        }

        return fs.createReadStream(filePath);
    }

    async getFileBuffer(filePath: string) {
        if (!fs.existsSync(filePath)) {
            throw new Error('Archivo no encontrado');
        }

        return fs.readFileSync(filePath);
    }

    // ========== MÉTODOS AUXILIARES DE SINCRONIZACIÓN ==========

    private async syncToCache(certificate: any): Promise<void> {
        try {
            await DocumentCacheService.syncCertificateFromPostgres(certificate);
        } catch (error) {
            console.error(`Error sincronizando certificado ${certificate.id} a cache:`, error);
        }
    }

    private async syncMultipleToCache(certificates: any[]): Promise<void> {
        try {
            console.log(`🔄 Sincronizando ${certificates.length} certificados a cache...`);

            for (const cert of certificates) {
                await this.syncToCache(cert);
            }

            console.log(`✅ ${certificates.length} certificados sincronizados a cache`);
        } catch (error) {
            console.error("Error en syncMultipleToCache:", error);
        }
    }

    private async syncControlAndCertsToCache(control: any): Promise<void> {
        try {
            // Sincronizar certificados
            if (control.certificates && control.certificates.length > 0) {
                await this.syncMultipleToCache(control.certificates);
            }
        } catch (error) {
            console.error("Error sincronizando control y certificados a cache:", error);
        }
    }

    // ========== MÉTODO PARA SINCRONIZACIÓN MANUAL ==========
    async syncCertificateToCache(id: number): Promise<boolean> {
        try {
            console.log(`🔄 Sincronizando certificado ${id} a cache manualmente...`);

            const certificate = await prisma.certificateDocument.findUnique({
                where: { id },
            });

            if (!certificate) {
                console.log(`❌ Certificado ${id} no encontrado en PostgreSQL`);
                return false;
            }

            await this.syncToCache(certificate);
            console.log(`✅ Certificado ${id} sincronizado a cache`);
            return true;
        } catch (error) {
            console.error(`Error sincronizando certificado ${id} a cache:`, error);
            return false;
        }
    }

    // ========== MÉTODO PARA BUSCAR CERTIFICADOS CON CACHE ==========
    public async searchCertificates(
        searchTerm: string = "",
        page: number = 1,
        limit: number = 10
    ): Promise<any> {
        try {
            // ESTRATEGIA CACHE-FIRST
            console.log(`🔍 Buscando certificados "${searchTerm}" en cache...`);
            const cacheResult = await DocumentCacheService.searchCacheCertificates(searchTerm, page, limit);

            if (cacheResult.data && cacheResult.data.length > 0) {
                console.log(`✅ ${cacheResult.data.length} certificados encontrados en cache`);
                return cacheResult;
            }

            // SI NO HAY EN CACHE: PostgreSQL
            console.log(`📦 Cache vacío, consultando PostgreSQL...`);

            const skip = (page - 1) * limit;

            let whereCondition: any = {};
            if (searchTerm.trim()) {
                whereCondition = {
                    isDeleted: false, // <--- Filtro de seguridad
                    OR: [
                        { certificateNumber: { contains: searchTerm, mode: 'insensitive' } },
                        { fileName: { contains: searchTerm, mode: 'insensitive' } },
                        { description: { contains: searchTerm, mode: 'insensitive' } }
                    ]
                }
            }

            const totalRecords = await prisma.certificateDocument.count({
                where: whereCondition
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
                            empresa_select: true
                        }
                    }
                },
                orderBy: {
                    uploadedAt: 'desc'
                }
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
                    hasPreviousPage
                }
            };

            // SINCRONIZAR CON CACHE
            this.syncMultipleToCache(certificates).catch(err =>
                console.error("Error sincronizando búsqueda a cache:", err)
            );

            return result;

        } catch (error) {
            console.error("Error buscando certificados:", error);
            throw error;
        }
    }
}

export const documentService = new DocumentService();
