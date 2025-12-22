import { SQLiteCache, sqliteCacheSync } from "../../cache/SqliteCache.js";
import { dataControl } from "../../dto/control.dto.js";

export class RegistersCacheService {
  private static db = sqliteCacheSync.getConnection();

  private static stripCacheFields(obj: any): any {
    const result = { ...obj };
    delete result._cached_at;
    delete result._expires_at;
    delete result._source;
    return result;
  }

  static async searchCacheRegisters(
    searchTerm: string,
    searchField: string = "all",
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {

    const skip = (page - 1) * limit;

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

    // contar
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM ControlRegister ${whereClause}`);
    const totalResult = countStmt.get(...params) as { total: number };
    const totalRecords = totalResult.total;

    const stmt = this.db.prepare(`
      SELECT * FROM ControlRegister 
      ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, skip) as any[];
    const data = rows.map(row => this.stripCacheFields(row))

    const totalPages = Math.ceil(totalRecords / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1

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
    }
  }

  // todos los registros
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
        SELECT * FROM ControlRegister 
        WHERE isDeleted = 0 
        ORDER BY createdAt DESC 
        LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, skip) as any[];
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
    }
  }

  // nuevo registro
  // nuevo registro
  static async createNewRegister(data: dataControl) {

    const stmt = this.db.prepare(`
            INSERT INTO ControlRegister (
            userId, agente, fecha, lugar, conductor_nombre, licencia_tipo,
            licencia_numero, licencia_vencimiento, empresa_select, dominio,
            interno, c_matriculacion_venc, c_matriculacion_cert, seguro_venc,
            seguro_cert, rto_venc, rto_cert, tacografo_venc, tacografo_cert,
            createdAt, updatedAt, _cached_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `);

    // CONVERSIÓN DE FECHAS A STRINGS (AGREGAR ESTO)
    const fecha = data.fecha instanceof Date ? data.fecha.toISOString() : data.fecha;
    const licenciaVencimiento = data.licencia_vencimiento ? new Date(data.licencia_vencimiento).toISOString() : null;
    const cMatriculacionVenc = data.c_matriculacion_venc instanceof Date ? data.c_matriculacion_venc.toISOString() : data.c_matriculacion_venc;
    const seguroVenc = data.seguro_venc instanceof Date ? data.seguro_venc.toISOString() : data.seguro_venc;
    const rtoVenc = data.rto_venc instanceof Date ? data.rto_venc.toISOString() : data.rto_venc;
    const tacografoVenc = data.tacografo_venc instanceof Date ? data.tacografo_venc.toISOString() : data.tacografo_venc;

    const result = stmt.run(
      data.userId,
      data.agente,
      fecha,  // <-- Usar la variable convertida
      data.lugar,
      data.conductor_nombre,
      data.licencia_tipo,
      data.licencia_numero,
      licenciaVencimiento,  // <-- Usar la variable convertida
      data.empresa_select,
      data.dominio,
      data.interno || null,
      cMatriculacionVenc,  // <-- Usar la variable convertida
      data.c_matriculacion_cert || null,
      seguroVenc,  // <-- Usar la variable convertida
      data.seguro_cert || null,
      rtoVenc,  // <-- Usar la variable convertida
      data.rto_cert || null,
      tacografoVenc,  // <-- Usar la variable convertida
      data.tacografo_cert || null
    );

    return result.lastInsertRowid as number;
  }

  // verificar que certificados fueron cargados
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
    // Nota: En SQLite las foreign keys no están activas por defecto
    // Eliminar control (los certificados se manejarán por cascada en PostgreSQL)
    const stmt = this.db.prepare(
      "DELETE FROM ControlRegister WHERE id = ?"
    );

    const result = stmt.run(controlId);
    return result.changes > 0;
  }

  // Método auxiliar para actualizar un registro
  // Método auxiliar para actualizar un registro
  static async updateRegistry(id: number, data: any): Promise<boolean> {
    // FUNCIÓN DE CONVERSIÓN (AGREGAR ESTO AL INICIO DEL MÉTODO)
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
        isDeleted = ?,
        updatedAt = datetime('now'), _cached_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(
      data.agente,
      convertDate(data.fecha),  // <-- Usar la función de conversión
      data.lugar,
      data.conductor_nombre,
      data.licencia_tipo,
      data.licencia_numero,
      convertDate(data.licencia_vencimiento),  // <-- Usar la función de conversión
      data.empresa_select,
      data.dominio,
      data.interno,
      convertDate(data.c_matriculacion_venc),  // <-- Usar la función de conversión
      data.c_matriculacion_cert,
      convertDate(data.seguro_venc),  // <-- Usar la función de conversión
      data.seguro_cert,
      convertDate(data.rto_venc),  // <-- Usar la función de conversión
      data.rto_cert,
      convertDate(data.tacografo_venc),  // <-- Usar la función de conversión
      data.tacografo_cert,
      id,
      data.isDeleted ? 1 : 0
    );

    return result.changes > 0;
  }

  static async createNewRegisterWithId(id: number, data: dataControl): Promise<boolean> {
    const stmt = this.db.prepare(`
      INSERT INTO ControlRegister (
        id, userId, agente, fecha, lugar, conductor_nombre, licencia_tipo,
        licencia_numero, licencia_vencimiento, empresa_select, dominio,
        interno, c_matriculacion_venc, c_matriculacion_cert, seguro_venc,
        seguro_cert, rto_venc, rto_cert, tacografo_venc, tacografo_cert,
        createdAt, updatedAt, _cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `);

    try {
      // CONVERSIÓN DE FECHAS A STRINGS (AGREGAR ESTO)
      const fecha = data.fecha instanceof Date ? data.fecha.toISOString() : data.fecha;
      const licenciaVencimiento = data.licencia_vencimiento ? new Date(data.licencia_vencimiento).toISOString() : null;
      const cMatriculacionVenc = data.c_matriculacion_venc instanceof Date ? data.c_matriculacion_venc.toISOString() : data.c_matriculacion_venc;
      const seguroVenc = data.seguro_venc instanceof Date ? data.seguro_venc.toISOString() : data.seguro_venc;
      const rtoVenc = data.rto_venc instanceof Date ? data.rto_venc.toISOString() : data.rto_venc;
      const tacografoVenc = data.tacografo_venc instanceof Date ? data.tacografo_venc.toISOString() : data.tacografo_venc;

      const result = stmt.run(
        id,
        data.userId,
        data.agente,
        fecha,  // <-- Usar la variable convertida
        data.lugar,
        data.conductor_nombre,
        data.licencia_tipo,
        data.licencia_numero,
        licenciaVencimiento,  // <-- Usar la variable convertida
        data.empresa_select,
        data.dominio,
        data.interno || null,
        cMatriculacionVenc,  // <-- Usar la variable convertida
        data.c_matriculacion_cert || null,
        seguroVenc,  // <-- Usar la variable convertida
        data.seguro_cert || null,
        rtoVenc,  // <-- Usar la variable convertida
        data.rto_cert || null,
        tacografoVenc,  // <-- Usar la variable convertida
        data.tacografo_cert || null
      );
      return result.changes > 0;
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return await this.updateRegistry(id, data);
      }
      throw error;
    }
  }

  // NUEVO: Eliminar registro por ID temporal (para rollback)
  static async deleteRegistryByTempId(tempId: number): Promise<boolean> {
    const stmt = this.db.prepare(
      "DELETE FROM ControlRegister WHERE rowid = ?"
    );
    const result = stmt.run(tempId);
    return result.changes > 0;
  }

  // NUEVO: Obtener registro por ID temporal (para rollback)
  static async getRegistryByTempId(tempId: number) {
    const stmt = this.db.prepare(
      "SELECT * FROM ControlRegister WHERE rowid = ?"
    );
    const row = stmt.get(tempId) as any;
    return row ? this.stripCacheFields(row) : null;
  }

  // NUEVO: Actualizar ID temporal con ID real de PostgreSQL
  static async updateTempIdToRealId(tempId: number, realId: number): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE ControlRegister 
      SET id = ?, _cached_at = datetime('now')
      WHERE rowid = ?
    `);
    const result = stmt.run(realId, tempId);
    return result.changes > 0;
  }

  // NUEVO: Sincronizar registro completo desde PostgreSQL
  static async syncFullRegistryFromPostgres(registry: any): Promise<void> {
    // Primero verificar si existe
    const existing = await this.getRegistryById(registry.id);

    const registryData = {
      userId: registry.userId,
      agente: registry.agente,
      fecha: registry.fecha,
      lugar: registry.lugar,
      conductor_nombre: registry.conductor_nombre,
      licencia_tipo: registry.licencia_tipo,
      licencia_numero: registry.licencia_numero,
      licencia_vencimiento: registry.licencia_vencimiento,
      empresa_select: registry.empresa_select,
      dominio: registry.dominio,
      interno: registry.interno,
      c_matriculacion_venc: registry.c_matriculacion_venc,
      c_matriculacion_cert: registry.c_matriculacion_cert,
      seguro_venc: registry.seguro_venc,
      seguro_cert: registry.seguro_cert,
      rto_venc: registry.rto_venc,
      rto_cert: registry.rto_cert,
      tacografo_venc: registry.tacografo_venc,
      tacografo_cert: registry.tacografo_cert,
      createdAt: registry.createdAt,
      updatedAt: registry.updatedAt,
      isDeleted: registry.isDeleted ? 1 : 0,
      deletedAt: registry.deletedAt instanceof Date ? registry.deletedAt.toISOString() : registry.deletedAt
    };

    if (existing) {
      await this.updateRegistry(registry.id, registryData);
    } else {
      await this.createNewRegisterWithId(registry.id, {
        ...registryData,
        licencia_vencimiento: registry.licencia_vencimiento?.toISOString() || '',
      } as dataControl);
    }
  }
}