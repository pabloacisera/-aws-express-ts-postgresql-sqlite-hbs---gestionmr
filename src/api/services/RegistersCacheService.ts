import { SQLiteCache, sqliteCacheSync } from "../../cache/SqliteCache.js";
import { dataControl } from "../../dto/control.dto.js";

export class RegistersCacheService {
  private static db = sqliteCacheSync.getConnection();

  private static stripCacheFields(obj: any): any {
    const result = { ...obj };
    delete result._cached_at;
    delete result._expires_at;
    delete result._source;

    // Parsear campos JSON si existen
    if (result.certificates && typeof result.certificates === 'string') {
      try {
        result.certificates = JSON.parse(result.certificates);
      } catch (e) {
        result.certificates = [];
      }
    }

    if (result.documentSummary && typeof result.documentSummary === 'string') {
      try {
        result.documentSummary = JSON.parse(result.documentSummary);
      } catch (e) {
        result.documentSummary = { total: 0, types: [], byType: {}, latestDocument: null };
      }
    }

    if (result.user && typeof result.user === 'string') {
      try {
        result.user = JSON.parse(result.user);
      } catch (e) {
        result.user = { id: result.userId, name: '', email: '' };
      }
    }

    return result;
  }

  static async searchCacheRegisters(
    searchTerm: string,
    searchField: string = "all",
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {

    const skip = (page - 1) * limit;

    // EL FILTRO MÁS IMPORTANTE: isDeleted = 0
    let whereClause = "WHERE isDeleted = 0";
    const params: any[] = [];

    if (searchTerm.trim()) {
      const likeTerm = `%${searchTerm}%`;
      if (searchField === "all") {
        whereClause += `
                AND (conductor_nombre LIKE ? OR
                    empresa_select LIKE ? OR
                    interno LIKE ? OR
                    dominio LIKE ? OR
                    agente LIKE ?
                    )`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      } else {
        whereClause += ` AND ${searchField} LIKE ?`;
        params.push(likeTerm);
      }
    }

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM ControlRegister ${whereClause}`);
    const totalResult = countStmt.get(...params) as { total: number };
    const totalRecords = totalResult.total;

    const stmt = this.db.prepare(`
    SELECT *, 
           COALESCE(certificates, '[]') as certificates,
           COALESCE(documentSummary, '{"total":0,"types":[],"byType":{},"latestDocument":null}') as documentSummary,
           COALESCE(user, '{"id":userId,"name":"","email":""}') as user
    FROM ControlRegister 
    WHERE isDeleted = 0 
    ORDER BY createdAt DESC 
    LIMIT ? OFFSET ?
  `);

    const rows = stmt.all(...params, limit, skip) as any[];
    const data = rows.map(row => this.stripCacheFields(row))

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  }

  static async getAllRegistries(
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {

    const skip = (page - 1) * limit;

    const countStmt = this.db.prepare(`
                SELECT COUNT(*) as total FROM ControlRegister WHERE isDeleted = 0
            `);
    const totalResult = countStmt.get() as { total: number };
    const totalRecords = totalResult.total;

    const stmt = this.db.prepare(`
    SELECT *, 
           COALESCE(certificates, '[]') as certificates,
           COALESCE(documentSummary, '{"total":0,"types":[],"byType":{},"latestDocument":null}') as documentSummary,
           COALESCE(user, '{"id":userId,"name":"","email":""}') as user
    FROM ControlRegister 
    WHERE isDeleted = 0 
    ORDER BY createdAt DESC 
    LIMIT ? OFFSET ?
  `);

    const rows = stmt.all(limit, skip) as any[];
    const data = rows.map(row => this.stripCacheFields(row));

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  }

  static async createNewRegister(data: dataControl) {
    const stmt = this.db.prepare(`
            INSERT INTO ControlRegister (
            userId, agente, fecha, lugar, conductor_nombre, licencia_tipo,
            licencia_numero, licencia_vencimiento, empresa_select, dominio,
            interno, c_matriculacion_venc, c_matriculacion_cert, seguro_venc,
            seguro_cert, rto_venc, rto_cert, tacografo_venc, tacografo_cert,
            isDeleted, createdAt, updatedAt, _cached_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `);

    const fecha = data.fecha instanceof Date ? data.fecha.toISOString() : data.fecha;
    const licenciaVencimiento = data.licencia_vencimiento ? new Date(data.licencia_vencimiento).toISOString() : null;
    const cMatriculacionVenc = data.c_matriculacion_venc instanceof Date ? data.c_matriculacion_venc.toISOString() : data.c_matriculacion_venc;
    const seguroVenc = data.seguro_venc instanceof Date ? data.seguro_venc.toISOString() : data.seguro_venc;
    const rtoVenc = data.rto_venc instanceof Date ? data.rto_venc.toISOString() : data.rto_venc;
    const tacografoVenc = data.tacografo_venc instanceof Date ? data.tacografo_venc.toISOString() : data.tacografo_venc;

    const result = stmt.run(
      data.userId, data.agente, fecha, data.lugar, data.conductor_nombre, data.licencia_tipo,
      data.licencia_numero, licenciaVencimiento, data.empresa_select, data.dominio,
      data.interno || null, cMatriculacionVenc, data.c_matriculacion_cert || null, seguroVenc,
      data.seguro_cert || null, rtoVenc, data.rto_cert || null, tacografoVenc, data.tacografo_cert || null,
      0 // isDeleted: 0 (falso)
    );

    return result.lastInsertRowid as number;
  }

  static async checkCertificatesStatus(id: number) {
    const control = await this.getRegistryById(id);
    if (!control) return null;

    const cMatriculacionStatus = !!control.c_matriculacion_cert?.trim();
    const seguroStatus = !!control.seguro_cert?.trim();
    const rtoStatus = !!control.rto_cert?.trim();
    const tacografoStatus = !!control.tacografo_cert?.trim();

    return {
      id: control.id,
      c_matriculacion_cert: cMatriculacionStatus,
      seguro_cert: seguroStatus,
      rto_cert: rtoStatus,
      tacografo_cert: tacografoStatus,
      allComplete: cMatriculacionStatus && seguroStatus && rtoStatus && tacografoStatus,
      missingFields: [
        ...(!cMatriculacionStatus ? ["c_matriculacion_cert"] : []),
        ...(!seguroStatus ? ["seguro_cert"] : []),
        ...(!rtoStatus ? ["rto_cert"] : []),
        ...(!tacografoStatus ? ["tacografo_cert"] : []),
      ],
    };
  }

  static async getRegistryById(id: number) {
    const stmt = this.db.prepare(
      "SELECT * FROM ControlRegister WHERE id = ? AND isDeleted = 0"
    );

    const row = stmt.get(id) as any;
    return row ? this.stripCacheFields(row) : null;
  }

  static async getCertificateNumbersById(id: number) {
    const control = await this.getRegistryById(id);
    if (!control) return null;

    return {
      c_matriculacion_cert: control.c_matriculacion_cert,
      seguro_cert: control.seguro_cert,
      rto_cert: control.rto_cert,
      tacografo_cert: control.tacografo_cert,
    };
  }

  static async deleteRegistry(controlId: number): Promise<boolean> {
    const stmt = this.db.prepare(
      "DELETE FROM ControlRegister WHERE id = ?"
    );

    const result = stmt.run(controlId);
    return result.changes > 0;
  }


  // Modificar updateRegistry():
  static async updateRegistry(id: number, data: any): Promise<boolean> {
    const convertDate = (date: any): string | null => {
      if (date instanceof Date) return date.toISOString();
      return date;
    };

    const stmt = this.db.prepare(`
    UPDATE ControlRegister SET
      agente = ?, fecha = ?, lugar = ?, conductor_nombre = ?,
      licencia_tipo = ?, licencia_numero = ?, licencia_vencimiento = ?,
      empresa_select = ?, dominio = ?, interno = ?,
      c_matriculacion_venc = ?, c_matriculacion_cert = ?,
      seguro_venc = ?, seguro_cert = ?,
      rto_venc = ?, rto_cert = ?,
      tacografo_venc = ?, tacografo_cert = ?,
      certificates = ?, documentSummary = ?, user = ?,
      isDeleted = ?, deletedAt = ?, createdAt = ?, updatedAt = ?,
      _cached_at = datetime('now')
    WHERE id = ?
  `);

    const result = stmt.run(
      data.agente, convertDate(data.fecha), data.lugar, data.conductor_nombre,
      data.licencia_tipo, data.licencia_numero, convertDate(data.licencia_vencimiento),
      data.empresa_select, data.dominio, data.interno || null,
      convertDate(data.c_matriculacion_venc), data.c_matriculacion_cert || null,
      convertDate(data.seguro_venc), data.seguro_cert || null,
      convertDate(data.rto_venc), data.rto_cert || null,
      convertDate(data.tacografo_venc), data.tacografo_cert || null,
      data.certificates || '[]',
      data.documentSummary || '{"total":0,"types":[],"byType":{},"latestDocument":null}',
      data.user || `{"id":${data.userId || 0},"name":"","email":""}`,
      (data.isDeleted === true || data.isDeleted === 1) ? 1 : 0,
      convertDate(data.deletedAt),
      convertDate(data.createdAt),
      convertDate(data.updatedAt),
      id
    );

    return result.changes > 0;
  }

  // Modificar createNewRegisterWithId():
static async createNewRegisterWithId(id: number, data: dataControl): Promise<boolean> {
  const stmt = this.db.prepare(`
    INSERT INTO ControlRegister (
      id, userId, agente, fecha, lugar, conductor_nombre, licencia_tipo,
      licencia_numero, licencia_vencimiento, empresa_select, dominio,
      interno, c_matriculacion_venc, c_matriculacion_cert, seguro_venc,
      seguro_cert, rto_venc, rto_cert, tacografo_venc, tacografo_cert,
      certificates, documentSummary, user,
      isDeleted, createdAt, updatedAt, _cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  try {
    const result = stmt.run(
      id,
      data.userId,
      data.agente,
      data.fecha instanceof Date ? data.fecha.toISOString() : data.fecha,
      data.lugar,
      data.conductor_nombre,
      data.licencia_tipo,
      data.licencia_numero,
      data.licencia_vencimiento ? new Date(data.licencia_vencimiento).toISOString() : null,
      data.empresa_select,
      data.dominio,
      data.interno || null,
      data.c_matriculacion_venc instanceof Date ? data.c_matriculacion_venc.toISOString() : data.c_matriculacion_venc,
      data.c_matriculacion_cert || null,
      data.seguro_venc instanceof Date ? data.seguro_venc.toISOString() : data.seguro_venc,
      data.seguro_cert || null,
      data.rto_venc instanceof Date ? data.rto_venc.toISOString() : data.rto_venc,
      data.rto_cert || null,
      data.tacografo_venc instanceof Date ? data.tacografo_venc.toISOString() : data.tacografo_venc,
      data.tacografo_cert || null,
      data.certificates || '[]',
      data.documentSummary || '{"total":0,"types":[],"byType":{},"latestDocument":null}',
      data.user || `{"id":${data.userId},"name":"","email":""}`,
      (data.isDeleted === true || (data as any).isDeleted === 1) ? 1 : 0,
      data.createdAt instanceof Date ? data.createdAt.toISOString() : (data.createdAt || new Date().toISOString()),
      data.updatedAt instanceof Date ? data.updatedAt.toISOString() : (data.updatedAt || new Date().toISOString())
    );
    return result.changes > 0;
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return await this.updateRegistry(id, data);
    }
    throw error;
  }
}

  static async deleteRegistryByTempId(tempId: number): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM ControlRegister WHERE rowid = ?");
    const result = stmt.run(tempId);
    return result.changes > 0;
  }

  static async getRegistryByTempId(tempId: number) {
    const stmt = this.db.prepare("SELECT * FROM ControlRegister WHERE rowid = ?");
    const row = stmt.get(tempId) as any;
    return row ? this.stripCacheFields(row) : null;
  }

  static async updateTempIdToRealId(tempId: number, realId: number): Promise<boolean> {
    const stmt = this.db.prepare("UPDATE ControlRegister SET id = ?, _cached_at = datetime('now') WHERE rowid = ?");
    const result = stmt.run(realId, tempId);
    return result.changes > 0;
  }

  static async syncFullRegistryFromPostgres(registry: any): Promise<void> {
    const registryData = {
      ...registry,
      isDeleted: registry.isDeleted ? 1 : 0,
      deletedAt: registry.deletedAt instanceof Date ? registry.deletedAt.toISOString() : registry.deletedAt
    };

    const success = await this.updateRegistry(registry.id, registryData);
    if (!success) {
      await this.createNewRegisterWithId(registry.id, registryData as dataControl);
    }
  }

  // En RegistersCacheService.ts, agrega este método:
  static async ensureTableStructure(): Promise<void> {
    try {
      console.log("🔄 Verificando estructura de tabla ControlRegister...");

      // Verificar si la tabla existe
      const tableExists = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ControlRegister'
    `).get();

      if (!tableExists) {
        console.log("📋 Creando tabla ControlRegister...");
        const createTableStmt = this.db.prepare(`
        CREATE TABLE ControlRegister (
          id INTEGER PRIMARY KEY,
          userId INTEGER,
          agente TEXT,
          fecha TEXT,
          lugar TEXT,
          conductor_nombre TEXT,
          licencia_tipo TEXT,
          licencia_numero TEXT,
          licencia_vencimiento TEXT,
          empresa_select TEXT,
          dominio TEXT,
          interno TEXT,
          c_matriculacion_venc TEXT,
          c_matriculacion_cert TEXT,
          seguro_venc TEXT,
          seguro_cert TEXT,
          rto_venc TEXT,
          rto_cert TEXT,
          tacografo_venc TEXT,
          tacografo_cert TEXT,
          certificates TEXT DEFAULT '[]',
          documentSummary TEXT DEFAULT '{"total":0,"types":[],"byType":{},"latestDocument":null}',
          user TEXT DEFAULT '{"id":0,"name":"","email":""}',
          isDeleted INTEGER DEFAULT 0,
          deletedAt TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          _cached_at TEXT,
          _expires_at TEXT,
          _source TEXT
        )
      `);
        createTableStmt.run();
        console.log("✅ Tabla ControlRegister creada");
      } else {
        // Verificar y agregar columnas faltantes
        const columns = this.db.prepare(`PRAGMA table_info(ControlRegister)`).all();
        const columnNames = columns.map((col: any) => col.name);

        const missingColumns = [];

        if (!columnNames.includes('certificates')) {
          missingColumns.push('certificates');
          this.db.prepare(`ALTER TABLE ControlRegister ADD COLUMN certificates TEXT DEFAULT '[]'`).run();
        }

        if (!columnNames.includes('documentSummary')) {
          missingColumns.push('documentSummary');
          this.db.prepare(`ALTER TABLE ControlRegister ADD COLUMN documentSummary TEXT DEFAULT '{"total":0,"types":[],"byType":{},"latestDocument":null}'`).run();
        }

        if (!columnNames.includes('user')) {
          missingColumns.push('user');
          this.db.prepare(`ALTER TABLE ControlRegister ADD COLUMN user TEXT DEFAULT '{"id":0,"name":"","email":""}'`).run();
        }

        if (missingColumns.length > 0) {
          console.log(`➕ Columnas agregadas: ${missingColumns.join(', ')}`);
        }
      }

      console.log("✅ Estructura de tabla verificada");
    } catch (error) {
      console.error("Error verificando estructura de tabla:", error);
    }
  }
}