export interface UploadCertificate {
    controlId: number;
    certificateType: 'C_MATRICULACION' | 'SEGURO' | 'RTO' | 'TACOGRAFO';
    certificateNumber: string;
    description?: string;
    expirationDate?: string;
}

export interface CertificateDocument {
    id: number;
    controlId: number;
    certificateType: string;
    certificateNumber: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    description?: string;
    uploadedAt: Date;
    control?: {
        id: number;
        dominio: string;
        conductor_nombre: string;
        empresa_select: string;
    }
}

export interface CertificateStatusDTO {
  type: 'C_MATRICULACION' | 'SEGURO' | 'RTO' | 'TACOGRAFO';
  label: string;
  certificateNumber: string | null;
  hasCertificate: boolean;
  hasDocument: boolean;
  document: {
    id: number;
    fileName: string;
    uploadedAt: Date;
    mimeType: string;
    description?: string;
  } | null;
  canUpload: boolean;
  canUpdate: boolean;
}