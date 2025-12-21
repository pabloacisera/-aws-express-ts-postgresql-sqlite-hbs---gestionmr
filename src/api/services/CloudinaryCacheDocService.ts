// CloudinaryCacheDocService.ts
import { $Enums } from "@prisma/client";
import { sqliteCacheSync } from "../../cache/SqliteCache.js";

export class CloudinaryCacheDocService {
  private sqliteDb: any;

  constructor() {
    this.sqliteDb = sqliteCacheSync.getConnection();
  }

  // 🔍 Buscar certificado por ID en SQLite (caché)
  public async getCertificateById(id: number) {
    try {
      console.log(`🔍 Buscando certificado ${id} en SQLite cache...`);
      
      const cert = this.sqliteDb.prepare(`
        SELECT 
          cd.*,
          cr.id as control_id,
          cr.dominio as control_dominio,
          cr.conductor_nombre as control_conductor_nombre,
          cr.empresa_select as control_empresa_select
        FROM CertificateDocument cd
        LEFT JOIN ControlRegister cr ON cd.controlId = cr.id
        WHERE cd.id = ?
      `).get(id);

      if (cert) {
        console.log(`✅ Certificado ${id} encontrado en SQLite cache`);
        return {
          id: cert.id,
          controlId: cert.controlId,
          certificateType: cert.certificateType,
          certificateNumber: cert.certificateNumber,
          fileName: cert.fileName,
          filePath: cert.filePath,
          publicId: cert.publicId,
          fileSize: cert.fileSize,
          mimeType: cert.mimeType,
          description: cert.description,
          uploadedAt: new Date(cert.uploadedAt),
          control: cert.control_id ? {
            id: cert.control_id,
            dominio: cert.control_dominio,
            conductor_nombre: cert.control_conductor_nombre,
            empresa_select: cert.control_empresa_select
          } : null
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error al buscar certificado en SQLite cache:', error);
      return null;
    }
  }

  // 🔍 Buscar certificado por tipo en SQLite (caché)
  public async getCertificateByType(controlId: number, certificateType: $Enums.CertificateType) {
    try {
      console.log(`🔍 Buscando certificado ${certificateType} para control ${controlId} en SQLite cache...`);
      
      const cert = this.sqliteDb.prepare(`
        SELECT * FROM CertificateDocument 
        WHERE controlId = ? AND certificateType = ?
        ORDER BY uploadedAt DESC
        LIMIT 1
      `).get(controlId, certificateType);

      if (cert) {
        console.log(`✅ Certificado encontrado en SQLite cache`);
        return {
          id: cert.id,
          controlId: cert.controlId,
          certificateType: cert.certificateType,
          certificateNumber: cert.certificateNumber,
          fileName: cert.fileName,
          filePath: cert.filePath,
          publicId: cert.publicId,
          fileSize: cert.fileSize,
          mimeType: cert.mimeType,
          description: cert.description,
          uploadedAt: new Date(cert.uploadedAt)
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error al buscar certificado por tipo en SQLite cache:', error);
      return null;
    }
  }

  // 🔍 Buscar todos los certificados por control en SQLite (caché)
  public async getAllCertificatesById(controlId: number) {
    try {
      console.log(`🔍 Buscando todos certificados para control ${controlId} en SQLite cache...`);
      
      const certs = this.sqliteDb.prepare(`
        SELECT * FROM CertificateDocument 
        WHERE controlId = ?
        ORDER BY uploadedAt DESC
      `).all(controlId);

      if (certs.length > 0) {
        console.log(`✅ ${certs.length} certificados encontrados en SQLite cache`);
        return certs.map((cert: any) => ({
          id: cert.id,
          controlId: cert.controlId,
          certificateType: cert.certificateType,
          certificateNumber: cert.certificateNumber,
          fileName: cert.fileName,
          filePath: cert.filePath,
          publicId: cert.publicId,
          fileSize: cert.fileSize,
          mimeType: cert.mimeType,
          description: cert.description,
          uploadedAt: new Date(cert.uploadedAt)
        }));
      }

      return [];
    } catch (error) {
      console.error('❌ Error al buscar certificados en SQLite cache:', error);
      return [];
    }
  }

  // 🔍 Obtener estado de certificados desde SQLite (caché)
  public async getCertificateStatus(controlId: number) {
    try {
      console.log(`🔍 Buscando estado de certificados para control ${controlId} en SQLite cache...`);
      
      // Buscar control en SQLite
      const control = this.sqliteDb.prepare(`
        SELECT * FROM ControlRegister WHERE id = ?
      `).get(controlId);

      if (!control) {
        console.log(`📭 Control ${controlId} no encontrado en SQLite cache`);
        return null;
      }

      // Buscar certificados en SQLite
      const certs = this.sqliteDb.prepare(`
        SELECT * FROM CertificateDocument WHERE controlId = ?
      `).all(controlId);

      console.log(`✅ Control ${controlId} encontrado en SQLite cache`);
      
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
        const uploadedDoc = certs.find(
          (doc: any) => doc.certificateType === certType.type
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
    } catch (error) {
      console.error('❌ Error al obtener estado de certificados en SQLite cache:', error);
      return null;
    }
  }

  // 💾 Sincronizar certificado desde PostgreSQL a SQLite (caché)
  public async syncCertificateToSQLite(certificate: any): Promise<void> {
    try {
      console.log(`💾 Sincronizando certificado ${certificate.id} a SQLite cache...`);
      
      const stmt = this.sqliteDb.prepare(`
        INSERT OR REPLACE INTO CertificateDocument (
          id, controlId, certificateType, certificateNumber, fileName, 
          filePath, publicId, fileSize, mimeType, description, uploadedAt,
          _cached_at, _source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'postgres')
      `);
      
      stmt.run(
        certificate.id,
        certificate.controlId,
        certificate.certificateType,
        certificate.certificateNumber,
        certificate.fileName,
        certificate.filePath,
        certificate.publicId || null,
        certificate.fileSize,
        certificate.mimeType,
        certificate.description || null,
        certificate.uploadedAt?.toISOString() || new Date().toISOString()
      );

      console.log(`✅ Certificado ${certificate.id} sincronizado a SQLite cache`);
    } catch (error) {
      console.error('❌ Error al sincronizar certificado a SQLite cache:', error);
    }
  }

  // 💾 Sincronizar control desde PostgreSQL a SQLite (caché)
  public async syncControlToSQLite(control: any): Promise<void> {
    try {
      console.log(`💾 Sincronizando control ${control.id} a SQLite cache...`);
      
      const stmt = this.sqliteDb.prepare(`
        INSERT OR REPLACE INTO ControlRegister (
          id, userId, agente, fecha, lugar, conductor_nombre, licencia_tipo,
          licencia_numero, licencia_vencimiento, empresa_select, dominio, interno,
          c_matriculacion_venc, c_matriculacion_cert, seguro_venc, seguro_cert,
          rto_venc, rto_cert, tacografo_venc, tacografo_cert, createdAt, updatedAt,
          _cached_at, _source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'postgres')
      `);
      
      stmt.run(
        control.id,
        control.userId,
        control.agente,
        control.fecha?.toISOString(),
        control.lugar,
        control.conductor_nombre,
        control.licencia_tipo,
        control.licencia_numero,
        control.licencia_vencimiento?.toISOString(),
        control.empresa_select,
        control.dominio,
        control.interno || null,
        control.c_matriculacion_venc?.toISOString(),
        control.c_matriculacion_cert,
        control.seguro_venc?.toISOString(),
        control.seguro_cert,
        control.rto_venc?.toISOString(),
        control.rto_cert,
        control.tacografo_venc?.toISOString(),
        control.tacografo_cert,
        control.createdAt?.toISOString(),
        control.updatedAt?.toISOString()
      );

      console.log(`✅ Control ${control.id} sincronizado a SQLite cache`);
    } catch (error) {
      console.error('❌ Error al sincronizar control a SQLite cache:', error);
    }
  }

  // 🗑️ Eliminar certificado del caché SQLite
  public async deleteCertificateFromCache(id: number): Promise<void> {
    try {
      this.sqliteDb.prepare('DELETE FROM CertificateDocument WHERE id = ?').run(id);
      console.log(`🗑️ Certificado ${id} eliminado del SQLite cache`);
    } catch (error) {
      console.error('❌ Error al eliminar certificado del SQLite cache:', error);
    }
  }

  // 🗑️ Eliminar certificado por tipo del caché SQLite
  public async deleteCertificateByTypeFromCache(controlId: number, certificateType: $Enums.CertificateType): Promise<void> {
    try {
      this.sqliteDb.prepare(
        'DELETE FROM CertificateDocument WHERE controlId = ? AND certificateType = ?'
      ).run(controlId, certificateType);
      console.log(`🗑️ Certificado ${certificateType} eliminado del SQLite cache para control ${controlId}`);
    } catch (error) {
      console.error('❌ Error al eliminar certificado por tipo del SQLite cache:', error);
    }
  }

  // 🔧 Limpiar caché SQLite
  public async clearCache(): Promise<void> {
    try {
      this.sqliteDb.prepare('DELETE FROM CertificateDocument').run();
      this.sqliteDb.prepare('DELETE FROM ControlRegister').run();
      console.log('🧹 SQLite cache limpiado completamente');
    } catch (error) {
      console.error('❌ Error al limpiar SQLite cache:', error);
    }
  }

  // 📊 Obtener estadísticas del caché
  public async getCacheStats(): Promise<any> {
    try {
      const certCount = this.sqliteDb.prepare(
        'SELECT COUNT(*) as count FROM CertificateDocument'
      ).get();
      
      const controlCount = this.sqliteDb.prepare(
        'SELECT COUNT(*) as count FROM ControlRegister'
      ).get();

      return {
        certificates: certCount.count,
        controls: controlCount.count,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error al obtener estadísticas del cache:', error);
      return null;
    }
  }
}

export const cloudinaryCacheDocService = new CloudinaryCacheDocService();