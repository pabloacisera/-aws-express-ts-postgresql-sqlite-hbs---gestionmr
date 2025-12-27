import { Request, Response } from 'express';
import { CloudinaryDocService } from '../services/CloudinaryDocService.js';
import { UploadCertificate } from '../../dto/certificate.dto.js';

export class CertificateController {
    private documentService: CloudinaryDocService;

    constructor() {
        this.documentService = new CloudinaryDocService();
    }

    // DocumentController.ts - método upload
    public upload = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No se proporcionó archivo'
                });
                return;
            }

            // --- INICIO DE VALIDACIÓN DE TAMAÑO DINÁMICO ---
            const isImage = req.file.mimetype.startsWith('image/');
            const fileSizeInMB = req.file.size / (1024 * 1024);

            if (isImage) {
                // Límite para imágenes: 10MB
                if (fileSizeInMB > 10) {
                    res.status(413).json({
                        success: false,
                        error: `La imagen es demasiado grande (${fileSizeInMB.toFixed(2)}MB). El máximo permitido para fotos es 10MB.`
                    });
                    return;
                }
            } else {
                // Límite para otros archivos (PDF, DOCX, etc): 20MB
                if (fileSizeInMB > 20) {
                    res.status(413).json({
                        success: false,
                        error: `El documento es demasiado grande (${fileSizeInMB.toFixed(2)}MB). El máximo permitido para archivos es 20MB.`
                    });
                    return;
                }
            }
            // --- FIN DE VALIDACIÓN ---

            const { controlId, certificateType, certificateNumber, description, expirationDate } = req.body;

            if (!controlId || !certificateType || !certificateNumber) {
                res.status(400).json({
                    success: false,
                    error: 'Faltan campos requeridos: controlId, certificateType, certificateNumber'
                });
                return;
            }

            // Crear el DTO con o sin expirationDate
            const data: UploadCertificate = {
                controlId: parseInt(controlId),
                certificateType: certificateType as 'C_MATRICULACION' | 'SEGURO' | 'RTO' | 'TACOGRAFO',
                certificateNumber,
                description,
                expirationDate: expirationDate || undefined // Opcional
            };

            const certificate = await this.documentService.uploadCertificate(req.file, data);

            res.status(201).json({
                success: true,
                message: expirationDate
                    ? 'Documento reemplazado y fecha actualizada correctamente'
                    : 'Documento subido correctamente',
                data: certificate
            });

        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // 2. Obtener certificado por ID
    public getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                res.status(400).json({
                    success: false,
                    error: 'ID inválido'
                });
                return;
            }

            const certificate = await this.documentService.getCertificateById(parseInt(id));

            if (!certificate) {
                res.status(404).json({
                    success: false,
                    error: 'Certificado no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: certificate
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 3. Obtener certificado por tipo y control
    public getByType = async (req: Request, res: Response): Promise<void> => {
        try {
            const { controlId, certificateType } = req.params;

            if (!controlId || !certificateType) {
                res.status(400).json({
                    success: false,
                    error: 'Faltan parámetros: controlId y certificateType'
                });
                return;
            }

            const certificate = await this.documentService.getCertificateByType(
                parseInt(controlId),
                certificateType as any
            );

            if (!certificate) {
                res.status(404).json({
                    success: false,
                    error: 'Certificado no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: certificate
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 4. Obtener todos los certificados de un control
    public getAllByControlId = async (req: Request, res: Response): Promise<void> => {
        try {
            const { controlId } = req.params;

            if (!controlId || isNaN(parseInt(controlId))) {
                res.status(400).json({
                    success: false,
                    error: 'ID de control inválido'
                });
                return;
            }

            const certificates = await this.documentService.getAllCertificatesById(parseInt(controlId));

            res.json({
                success: true,
                data: certificates,
                count: certificates.length
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 5. Obtener estado de certificados de un control
    public getStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const { controlId } = req.params;

            if (!controlId || isNaN(parseInt(controlId))) {
                res.status(400).json({
                    success: false,
                    error: 'ID de control inválido'
                });
                return;
            }

            const status = await this.documentService.getCertificateStatus(parseInt(controlId));

            res.json({
                success: true,
                data: status
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 6. Eliminar certificado por ID
    public delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                res.status(400).json({
                    success: false,
                    error: 'ID inválido'
                });
                return;
            }

            await this.documentService.deleteCertificate(parseInt(id));

            res.json({
                success: true,
                message: 'Certificado eliminado correctamente'
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 7. Eliminar certificado por tipo
    public deleteByType = async (req: Request, res: Response): Promise<void> => {
        try {
            const { controlId, certificateType } = req.params;

            if (!controlId || !certificateType) {
                res.status(400).json({
                    success: false,
                    error: 'Faltan parámetros: controlId y certificateType'
                });
                return;
            }

            await this.documentService.deleteCertificateByType(
                parseInt(controlId),
                certificateType as any
            );

            res.json({
                success: true,
                message: 'Certificado eliminado correctamente'
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 8. Descargar archivo - ACTUALIZADO PARA CLOUDINARY
    public download = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                res.status(400).json({
                    success: false,
                    error: 'ID inválido'
                });
                return;
            }

            const certificate = await this.documentService.getCertificateById(parseInt(id));

            if (!certificate) {
                res.status(404).json({
                    success: false,
                    error: 'Certificado no encontrado'
                });
                return;
            }

            // Verificar que tenemos un publicId válido
            if (!certificate.publicId) {
                res.status(404).json({
                    success: false,
                    error: 'No se encontró el ID público del archivo'
                });
                return;
            }

            // Construir la URL de descarga forzada
            const cloudName = 'dg6q6wbva'; // Reemplaza con tu cloud_name
            const isImage = certificate.mimeType.startsWith('image/');
            const resourceType = isImage ? 'image' : 'raw';

            // Para descargar: agregar fl_attachment a la URL
            const downloadUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/fl_attachment/${certificate.publicId}`;

            res.redirect(downloadUrl);

        } catch (error: any) {
            console.error('❌ Error en download:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // 9. Previsualizar archivo - VERSIÓN CORREGIDA Y FUNCIONAL
    public preview = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                res.status(400).json({
                    success: false,
                    error: 'ID inválido'
                });
                return;
            }

            const certificate = await this.documentService.getCertificateById(parseInt(id));

            if (!certificate) {
                res.status(404).json({
                    success: false,
                    error: 'Certificado no encontrado'
                });
                return;
            }

            // Verificar que tenemos un publicId válido
            if (!certificate.publicId) {
                res.status(404).json({
                    success: false,
                    error: 'No se encontró el ID público del archivo'
                });
                return;
            }

            // Definir el resource_type de Cloudinary basándose en el mimeType
            const isImage = certificate.mimeType.startsWith('image/');
            const resourceType = isImage ? 'image' : 'raw';

            // Construir la URL correcta para Cloudinary
            // Formato: https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/<public_id>
            // NOTA: El publicId ya incluye la ruta completa en Cloudinary

            // URL base de Cloudinary
            const cloudName = 'dg6q6wbva';

            // Construir URL para previsualización
            const previewUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${certificate.publicId}`;
            // Redirigir a la URL construida
            res.redirect(previewUrl);

        } catch (error: any) {
            console.error('❌ Error en preview:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}