import { SQLiteCache, sqliteCacheSync } from "../../cache/SqliteCache.js";
import { UploadCertificate } from "../../dto/certificate.dto.js";
import { $Enums } from "@prisma/client";

export class DocumentCacheService {
  private static db = sqliteCacheSync.getConnection();

  private static stripCacheFields(obj: any): any {
    const result = { ...obj };
    delete result._cached_at;
    delete result._expires_at;
    delete result._source;
    return result;
  }

  // ========== BUSCAR CERTIFICADOS EN CACHE ==========
  static async searchCacheCertificates(
    searchTerm: string = "",
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    const skip = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (searchTerm.trim()) {
      whereClause += ` AND (
        certificateNumber LIKE ? OR 
        fileName LIKE ? OR
        description LIKE ?
      )`;
      const likeTerm = `%${searchTerm}%`;
      params.push(likeTerm, likeTerm, likeTerm);
    }

    // Contar
    const countStmt = this.db.prepare(
      `SELECT COUNT(*) as total FROM CertificateDocument ${whereClause}`
    );
    const totalResult = countStmt.get(...params) as { total: number };
    const totalRecords = totalResult.total;

    // Obtener datos
    const stmt = this.db.prepare(`
      SELECT cd.*, 
             cr.dominio,
             cr.conductor_nombre,
             cr.empresa_select
      FROM CertificateDocument cd
      LEFT JOIN ControlRegister cr ON cd.controlId = cr.id
      ${whereClause} 
      ORDER BY cd.uploadedAt DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, skip) as any[];
    const data = rows.map(row => this.stripCacheFields(row));

    const totalPages = Math.ceil(totalRecords / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
        hasNextPage,
        hasPreviousPage
      }
    };
  }

  // ========== OBTENER CERTIFICADO POR ID DESDE CACHE ==========
  static async getCertificateById(id: number) {
    const stmt = this.db.prepare(`
      SELECT cd.*, 
             cr.dominio,
             cr.conductor_nombre,
             cr.empresa_select
      FROM CertificateDocument cd
      LEFT JOIN ControlRegister cr ON cd.controlId = cr.id
      WHERE cd.id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.stripCacheFields(row) : null;
  }

  // ========== OBTENER CERTIFICADO POR TIPO DESDE CACHE ==========
  static async getCertificateByType(controlId: number, certificateType: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM CertificateDocument 
      WHERE controlId = ? AND certificateType = ?
    `);

    const row = stmt.get(controlId, certificateType) as any;
    return row ? this.stripCacheFields(row) : null;
  }

  // ========== OBTENER TODOS LOS CERTIFICADOS DE UN CONTROL ==========
  static async getAllCertificatesByControlId(controlId: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM CertificateDocument 
      WHERE controlId = ? 
      ORDER BY uploadedAt DESC
    `);

    const rows = stmt.all(controlId) as any[];
    return rows.map(row => this.stripCacheFields(row));
  }

  // ========== OBTENER ESTADO DE CERTIFICADOS DESDE CACHE ==========
  static async getCertificateStatus(controlId: number) {
    // Obtener control desde cache
    const controlStmt = this.db.prepare(`
      SELECT 
        id,
        c_matriculacion_cert,
        seguro_cert,
        rto_cert,
        tacografo_cert
      FROM ControlRegister 
      WHERE id = ?
    `);

    const control = controlStmt.get(controlId) as any;
    if (!control) return null;

    // Obtener certificados subidos desde cache
    const certsStmt = this.db.prepare(`
      SELECT * FROM CertificateDocument 
      WHERE controlId = ?
    `);

    const certificates = certsStmt.all(controlId) as any[];

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
      const uploadedDoc = certificates.find(
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
          uploadedAt: new Date(uploadedDoc.uploadedAt),
          mimeType: uploadedDoc.mimeType,
          description: uploadedDoc.description
        } : null,
        canUpload: certType.hasCertificate && !uploadedDoc,
        canUpdate: certType.hasCertificate && !!uploadedDoc
      };
    });

    return status;
  }

  // ========== INSERTAR/ACTUALIZAR CERTIFICADO EN CACHE ==========
  static async upsertCertificate(data: {
    id?: number;
    controlId: number;
    certificateType: string;
    certificateNumber: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    description?: string;
    uploadedAt: Date;
  }): Promise<number> {
    try {
      // Primero intentar actualizar si existe
      if (data.id) {
        const existing = await this.getCertificateById(data.id);
        if (existing) {
          const stmt = this.db.prepare(`
            UPDATE CertificateDocument SET
              controlId = ?,
              certificateType = ?,
              certificateNumber = ?,
              fileName = ?,
              filePath = ?,
              fileSize = ?,
              mimeType = ?,
              description = ?,
              uploadedAt = ?,
              _cached_at = datetime('now')
            WHERE id = ?
          `);

          const result = stmt.run(
            data.controlId,
            data.certificateType,
            data.certificateNumber,
            data.fileName,
            data.filePath,
            data.fileSize,
            data.mimeType,
            data.description || null,
            data.uploadedAt.toISOString(),
            data.id
          );

          return data.id;
        }
      }

      // Si no existe, insertar nuevo
      const stmt = this.db.prepare(`
        INSERT INTO CertificateDocument (
          id, controlId, certificateType, certificateNumber,
          fileName, filePath, fileSize, mimeType, description,
          uploadedAt, _cached_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const result = stmt.run(
        data.id || null,
        data.controlId,
        data.certificateType,
        data.certificateNumber,
        data.fileName,
        data.filePath,
        data.fileSize,
        data.mimeType,
        data.description || null,
        data.uploadedAt.toISOString()
      );

      return result.lastInsertRowid as number;
    } catch (error: any) {
      console.error("Error en upsertCertificate cache:", error);
      throw error;
    }
  }

  // ========== ELIMINAR CERTIFICADO DEL CACHE ==========
  static async deleteCertificate(id: number): Promise<boolean> {
    const stmt = this.db.prepare(
      "DELETE FROM CertificateDocument WHERE id = ?"
    );

    const result = stmt.run(id);
    return result.changes > 0;
  }

  static async deleteCertificateByType(controlId: number, certificateType: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM CertificateDocument 
      WHERE controlId = ? AND certificateType = ?
    `);

    const result = stmt.run(controlId, certificateType);
    return result.changes > 0;
  }

  // ========== SINCRONIZAR CERTIFICADO DESDE POSTGRES ==========
  static async syncCertificateFromPostgres(certificate: any): Promise<void> {
    try {
      const existing = await this.getCertificateById(certificate.id);

      if (existing) {
        // Actualizar
        await this.upsertCertificate({
          id: certificate.id,
          controlId: certificate.controlId,
          certificateType: certificate.certificateType,
          certificateNumber: certificate.certificateNumber,
          fileName: certificate.fileName,
          filePath: certificate.filePath,
          fileSize: certificate.fileSize,
          mimeType: certificate.mimeType,
          description: certificate.description,
          uploadedAt: new Date(certificate.uploadedAt)
        });
      } else {
        // Insertar
        await this.upsertCertificate({
          id: certificate.id,
          controlId: certificate.controlId,
          certificateType: certificate.certificateType,
          certificateNumber: certificate.certificateNumber,
          fileName: certificate.fileName,
          filePath: certificate.filePath,
          fileSize: certificate.fileSize,
          mimeType: certificate.mimeType,
          description: certificate.description,
          uploadedAt: new Date(certificate.uploadedAt)
        });
      }
    } catch (error) {
      console.error("Error sincronizando certificado a cache:", error);
    }
  }

  // ========== LIMPIAR CACHE DE CERTIFICADOS ==========
  static async clearCertificateCache(): Promise<boolean> {
    try {
      const stmt = this.db.prepare("DELETE FROM CertificateDocument");
      const result = stmt.run();
      console.log(`🧹 Cache de certificados limpiado: ${result.changes} registros eliminados`);
      return true;
    } catch (error) {
      console.error("Error limpiando cache de certificados:", error);
      return false;
    }
  }

  // ========== OBTENER ESTADÍSTICAS DE CACHE ==========
  static async getCacheStats(): Promise<any> {
    const totalCerts = this.db.prepare(
      "SELECT COUNT(*) as total FROM CertificateDocument"
    ).get() as { total: number };

    const byType = this.db.prepare(`
      SELECT certificateType, COUNT(*) as count 
      FROM CertificateDocument 
      GROUP BY certificateType
    `).all() as any[];

    const recentCerts = this.db.prepare(`
      SELECT cd.*, cr.dominio, cr.conductor_nombre
      FROM CertificateDocument cd
      LEFT JOIN ControlRegister cr ON cd.controlId = cr.id
      ORDER BY cd.uploadedAt DESC
      LIMIT 10
    `).all() as any[];

    return {
      totalCertificates: totalCerts.total,
      byType: byType.map(item => ({
        type: item.certificateType,
        count: item.count
      })),
      recentCertificates: recentCerts.map(cert => this.stripCacheFields(cert)),
      lastUpdated: new Date().toISOString()
    };
  }
}