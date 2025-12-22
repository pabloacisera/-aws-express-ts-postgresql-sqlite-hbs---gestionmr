import { ControlRegister } from "@prisma/client";
import prisma from "../../config/prisma.client.js";
import { dataControl, PaginationResult } from "../../dto/control.dto.js";
import { RegistersCacheService } from "./RegistersCacheService.js";

export class RegistersService {
  
  // ========== MÉTODO DE BÚSQUEDA CON CACHE ==========
  static async searchRegistries(
    searchTerm: string,
    searchField: string = "all",
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginationResult> {
    try {
      // ESTRATEGIA CACHE-FIRST: Primero intentar desde SQLite
      console.log("🔍 Buscando en SQLite cache primero...");
      const cacheResult = await RegistersCacheService.searchCacheRegisters(
        searchTerm, searchField, page, limit
      );
      
      // Si hay datos en el cache, retornarlos inmediatamente
      if (cacheResult.data && cacheResult.data.length > 0) {
        console.log(`✅ ${cacheResult.data.length} registros encontrados en cache SQLite`);
        return cacheResult;
      }
      
      console.log("📦 Cache vacío, consultando PostgreSQL...");
      
      // Si no hay en cache, consultar PostgreSQL
      const skip = (page - 1) * limit;
      let whereCondition: any = { isDeleted: false };

      if (searchTerm.trim()) {
        if (searchField === "all") {
          whereCondition.OR =
            [
              {
                conductor_nombre: { contains: searchTerm, mode: "insensitive" },
              },
              { empresa_select: { contains: searchTerm, mode: "insensitive" } },
              { interno: { contains: searchTerm, mode: "insensitive" } },
              { dominio: { contains: searchTerm, mode: "insensitive" } },
              { agente: { contains: searchTerm, mode: "insensitive" } },
            ];
        } else {
          whereCondition[searchField] = {
            contains: searchTerm,
            mode: "insensitive",
          };
        }
      }

      const totalRecords = await prisma.controlRegister.count({
        where: whereCondition,
      });

      const results = await prisma.controlRegister.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          certificates: {
            select: {
              id: true,
              certificateType: true,
              certificateNumber: true,
              fileName: true,
              mimeType: true,
              uploadedAt: true,
              description: true,
            },
            orderBy: {
              uploadedAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Formatear resultados
      const formattedResults = results.map((register) => {
        const documentSummary = {
          total: register.certificates.length,
          types: register.certificates.map((cert) => cert.certificateType),
          byType: {
            C_MATRICULACION: register.certificates.filter(
              (cert) => cert.certificateType === "C_MATRICULACION",
            ).length,
            SEGURO: register.certificates.filter(
              (cert) => cert.certificateType === "SEGURO",
            ).length,
            RTO: register.certificates.filter(
              (cert) => cert.certificateType === "RTO",
            ).length,
            TACOGRAFO: register.certificates.filter(
              (cert) => cert.certificateType === "TACOGRAFO",
            ).length,
          },
          latestDocument:
            register.certificates.length > 0 ? register.certificates[0] : null,
        };

        return {
          ...register,
          documentSummary,
          certificates: register.certificates,
        };
      });

      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      const finalResult = {
        data: formattedResults,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
      };

      // GUARDAR EN CACHE para futuras consultas
      this.syncResultsToCache(formattedResults).catch(err => 
        console.error("Error sincronizando a cache:", err)
      );

      return finalResult;
      
    } catch (error) {
      console.error("Error en búsqueda:", error);
      throw new Error("No se pudo realizar la búsqueda");
    }
  }

  // ========== MÉTODO PARA OBTENER TODOS LOS REGISTROS CON CACHE ==========
  static async getAllRegistries(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginationResult> {
    try {
      // ESTRATEGIA CACHE-FIRST
      console.log("🔍 Consultando SQLite cache primero...");
      const cacheResult = await RegistersCacheService.getAllRegistries(page, limit);
      
      if (cacheResult.data && cacheResult.data.length > 0) {
        console.log(`✅ ${cacheResult.data.length} registros obtenidos desde cache SQLite`);
        return cacheResult;
      }
      
      console.log("📦 Cache vacío, consultando PostgreSQL...");
      
      // Si no hay en cache, consultar PostgreSQL
      const skip = (page - 1) * limit;
      const totalRecords = await prisma.controlRegister.count();

      const results = await prisma.controlRegister.findMany({
        skip: skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          certificates: {
            select: {
              id: true,
              certificateType: true,
              certificateNumber: true,
              fileName: true,
              mimeType: true,
              uploadedAt: true,
              description: true,
            },
            orderBy: {
              uploadedAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Transformar resultados
      const formattedResults = results.map((register) => {
        const documentSummary = {
          total: register.certificates.length,
          types: register.certificates.map((cert) => cert.certificateType),
          byType: {
            C_MATRICULACION: register.certificates.filter(
              (cert) => cert.certificateType === "C_MATRICULACION",
            ).length,
            SEGURO: register.certificates.filter(
              (cert) => cert.certificateType === "SEGURO",
            ).length,
            RTO: register.certificates.filter(
              (cert) => cert.certificateType === "RTO",
            ).length,
            TACOGRAFO: register.certificates.filter(
              (cert) => cert.certificateType === "TACOGRAFO",
            ).length,
          },
          latestDocument:
            register.certificates.length > 0 ? register.certificates[0] : null,
        };

        return {
          ...register,
          documentSummary,
          certificates: register.certificates,
        };
      });

      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      const finalResult = {
        data: formattedResults,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
      };

      // SINCRONIZAR CON CACHE
      this.syncResultsToCache(formattedResults).catch(err =>
        console.error("Error sincronizando a cache:", err)
      );

      return finalResult;
      
    } catch (error) {
      console.error("Error al obtener registros", error);
      throw new Error("No se han podido obtener registros");
    }
  }

  // ========== CREAR NUEVO REGISTRO CON SINCRONIZACIÓN ==========
  static async createNewRegister(data: dataControl): Promise<ControlRegister> {
    try {
      // PRIMERO: Crear en PostgreSQL (fuente de verdad)
      console.log("➕ Creando registro en PostgreSQL...");
      const newRegister = await prisma.controlRegister.create({
        data: {
          userId: data.userId,
          agente: data.agente,
          fecha: data.fecha ?? null,
          lugar: data.lugar,
          conductor_nombre: data.conductor_nombre,
          licencia_tipo: data.licencia_tipo,
          licencia_numero: data.licencia_numero,
          licencia_vencimiento: data.licencia_vencimiento
            ? new Date(data.licencia_vencimiento)
            : null,
          empresa_select: data.empresa_select,
          dominio: data.dominio,
          interno: data.interno ?? null,
          c_matriculacion_venc: data.c_matriculacion_venc ?? null,
          c_matriculacion_cert: data.c_matriculacion_cert ?? null,
          seguro_venc: data.seguro_venc ?? null,
          seguro_cert: data.seguro_cert ?? null,
          rto_venc: data.rto_venc ?? null,
          rto_cert: data.rto_cert ?? null,
          tacografo_venc: data.tacografo_venc ?? null,
          tacografo_cert: data.tacografo_cert ?? null,
        },
      });

      console.log(`✅ Registro creado en PostgreSQL con ID: ${newRegister.id}`);
      
      // LUEGO: Crear en SQLite cache con el ID real
      console.log("➕ Creando registro en SQLite cache...");
      try {
        await RegistersCacheService.createNewRegisterWithId(newRegister.id, data);
        console.log(`✅ Registro sincronizado a cache con ID: ${newRegister.id}`);
      } catch (cacheError) {
        console.error("⚠️ Error al sincronizar con cache (continuando):", cacheError);
        // No fallamos la operación principal si el cache falla
      }
      
      return newRegister;
      
    } catch (error) {
      console.error("Error al crear registro", error);
      throw new Error("No se ha podido crear el registro");
    }
  }

  // ========== OBTENER REGISTRO POR ID CON CACHE ==========
  static async getRegistryById(id: number) {
    try {
      // PRIMERO: Buscar en SQLite cache
      console.log(`🔍 Buscando registro ${id} en SQLite cache...`);
      const cachedRegistry = await RegistersCacheService.getRegistryById(id);
      
      if (cachedRegistry) {
        console.log(`✅ Registro ${id} encontrado en cache SQLite`);
        return cachedRegistry;
      }
      
      console.log(`📦 Registro ${id} no en cache, consultando PostgreSQL...`);
      
      // SI NO EXISTE EN CACHE: Consultar PostgreSQL
      const registry = await prisma.controlRegister.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          agente: true,
          fecha: true,
          lugar: true,
          conductor_nombre: true,
          licencia_tipo: true,
          licencia_numero: true,
          licencia_vencimiento: true,
          empresa_select: true,
          dominio: true,
          interno: true,
          c_matriculacion_venc: true,
          c_matriculacion_cert: true,
          seguro_venc: true,
          seguro_cert: true,
          rto_venc: true,
          rto_cert: true,
          tacografo_venc: true,
          tacografo_cert: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!registry) {
        throw new Error("Registro no encontrado");
      }

      console.log(`✅ Registro ${id} obtenido de PostgreSQL, guardando en cache...`);
      
      // GUARDAR EN CACHE para futuras consultas
      await this.syncSingleToCache(registry);
      
      return registry;
      
    } catch (error) {
      console.error("Error al obtener registro por ID:", error);
      throw new Error("No se pudo obtener el registro");
    }
  }

  // ========== ACTUALIZAR REGISTRO CON SINCRONIZACIÓN ==========
  static async updateRegistry(id: number, data: any) {
    try {
      // PRIMERO: Actualizar PostgreSQL (fuente de verdad)
      console.log(`✏️ Actualizando registro ${id} en PostgreSQL...`);
      const updatedRegistry = await prisma.controlRegister.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Registro ${id} actualizado en PostgreSQL`);
      
      // LUEGO: Actualizar SQLite cache
      console.log(`✏️ Sincronizando registro ${id} a SQLite cache...`);
      try {
        const cacheUpdated = await RegistersCacheService.updateRegistry(id, data);
        if (!cacheUpdated) {
          console.log(`⚠️ Registro ${id} no existía en cache, creando...`);
          // Si no existe en cache, crear con los datos actualizados
          const cacheData: dataControl = {
            userId: updatedRegistry.userId,
            agente: updatedRegistry.agente,
            fecha: updatedRegistry.fecha,
            lugar: updatedRegistry.lugar,
            conductor_nombre: updatedRegistry.conductor_nombre,
            licencia_tipo: updatedRegistry.licencia_tipo,
            licencia_numero: updatedRegistry.licencia_numero,
            licencia_vencimiento: updatedRegistry.licencia_vencimiento?.toISOString() || '',
            empresa_select: updatedRegistry.empresa_select,
            dominio: updatedRegistry.dominio,
            interno: updatedRegistry.interno,
            c_matriculacion_venc: updatedRegistry.c_matriculacion_venc,
            c_matriculacion_cert: updatedRegistry.c_matriculacion_cert,
            seguro_venc: updatedRegistry.seguro_venc,
            seguro_cert: updatedRegistry.seguro_cert,
            rto_venc: updatedRegistry.rto_venc,
            rto_cert: updatedRegistry.rto_cert,
            tacografo_venc: updatedRegistry.tacografo_venc,
            tacografo_cert: updatedRegistry.tacografo_cert,
          };
          await RegistersCacheService.createNewRegisterWithId(id, cacheData);
        }
        console.log(`✅ Registro ${id} sincronizado a cache`);
      } catch (cacheError) {
        console.error("⚠️ Error al actualizar cache (continuando):", cacheError);
        // No fallamos la operación principal si el cache falla
      }
      
      return updatedRegistry;
      
    } catch (error) {
      console.error("Error al actualizar registro:", error);
      throw new Error("No se pudo actualizar el registro");
    }
  }

  // ========== ELIMINAR REGISTRO CON SINCRONIZACIÓN ==========
  static async deleteRegistry(controlId: number) {
    try {
      // PRIMERO: Eliminar de PostgreSQL (fuente de verdad)
      console.log(`🗑️ Eliminando registro ${controlId} de PostgreSQL...`);
      
      const exists = await prisma.controlRegister.findUnique({
        where: { id: controlId },
      });

      if (!exists) {
        throw new Error("Registro no encontrado");
      }

      // eliminar certificados primero
      await prisma.certificateDocument.deleteMany({
        where: { controlId },
      });

      await prisma.controlRegister.update({
        where: { id: controlId },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      });

      console.log(`✅ Registro ${controlId} eliminado de PostgreSQL`);
      
      // LUEGO: Eliminar de SQLite cache
      console.log(`🗑️ Eliminando registro ${controlId} de SQLite cache...`);
      try {
        const cacheDeleted = await RegistersCacheService.deleteRegistry(controlId);
        console.log(cacheDeleted ? 
          `✅ Eliminado de cache` : 
          `⚠️ No existía en cache`
        );
      } catch (cacheError) {
        console.error("⚠️ Error al eliminar de cache (continuando):", cacheError);
        // No fallamos la operación principal si el cache falla
      }
      
      return true;
      
    } catch (err) {
      console.error("Error al eliminar el registro:", err);
      throw new Error("No se pudo eliminar el registro");
    }
  }

  // ========== VERIFICAR ESTADO DE CERTIFICADOS ==========
  static async checkCertificatesStatus(id: number) {
    try {
      // PRIMERO: Intentar desde cache
      const cacheStatus = await RegistersCacheService.checkCertificatesStatus(id);
      if (cacheStatus !== null) {
        console.log(`✅ Estado de certificados ${id} desde cache`);
        return cacheStatus;
      }
      
      // SI NO: Consultar PostgreSQL
      console.log(`🔍 Estado de certificados ${id} no en cache, consultando PostgreSQL...`);
      
      const controlRegister = await prisma.controlRegister.findUnique({
        where: { id },
        select: {
          id: true,
          c_matriculacion_cert: true,
          seguro_cert: true,
          rto_cert: true,
          tacografo_cert: true,
        },
      });

      if (!controlRegister) {
        return null;
      }

      const cMatriculacionStatus = !!controlRegister.c_matriculacion_cert?.trim();
      const seguroStatus = !!controlRegister.seguro_cert?.trim();
      const rtoStatus = !!controlRegister.rto_cert?.trim();
      const tacografoStatus = !!controlRegister.tacografo_cert?.trim();

      const status = {
        id: controlRegister.id,
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

      // Guardar en cache para futuras consultas
      this.syncSingleToCache(controlRegister).catch(err =>
        console.error(`Error guardando estado de certificados ${id} en cache:`, err)
      );

      return status;
    } catch (err) {
      console.error("Error checking certificates status:", err);
      throw err;
    }
  }

  // ========== OBTENER NÚMEROS DE CERTIFICADOS ==========
  static async getCertificateNumbersById(id: number) {
    try {
      // PRIMERO: Cache
      const cacheNumbers = await RegistersCacheService.getCertificateNumbersById(id);
      if (cacheNumbers) {
        console.log(`✅ Números de certificado ${id} desde cache`);
        return cacheNumbers;
      }
      
      // SI NO: PostgreSQL
      console.log(`🔍 Números de certificado ${id} no en cache, consultando PostgreSQL...`);
      
      const registry = await prisma.controlRegister.findUnique({
        where: { id, isDeleted: false },
        select: {
          id: true,
          c_matriculacion_cert: true,
          seguro_cert: true,
          rto_cert: true,
          tacografo_cert: true,
        },
      });

      if (!registry) {
        throw new Error("Registro no encontrado");
      }

      const numbers = {
        c_matriculacion_cert: registry.c_matriculacion_cert,
        seguro_cert: registry.seguro_cert,
        rto_cert: registry.rto_cert,
        tacografo_cert: registry.tacografo_cert,
      };

      // Guardar en cache para futuras consultas
      this.syncSingleToCache(registry).catch(err =>
        console.error(`Error guardando números de certificado ${id} en cache:`, err)
      );

      return numbers;
    } catch (error) {
      console.error("Error al obtener números de certificado:", error);
      throw new Error("No se pudieron obtener los números de certificado");
    }
  }

  // ========== MÉTODO PARA SINCRONIZACIÓN MANUAL ==========
  static async syncRegistryToCache(id: number): Promise<boolean> {
    try {
      console.log(`🔄 Sincronizando registro ${id} a cache...`);
      
      const registry = await prisma.controlRegister.findUnique({
        where: { id },
      });

      if (!registry) {
        console.log(`❌ Registro ${id} no encontrado en PostgreSQL`);
        return false;
      }

      await this.syncSingleToCache(registry);
      console.log(`✅ Registro ${id} sincronizado a cache`);
      return true;
    } catch (error) {
      console.error(`Error sincronizando registro ${id} a cache:`, error);
      return false;
    }
  }

  // ========== MÉTODO PARA SINCRONIZAR MÚLTIPLES REGISTROS ==========
  static async syncMultipleRegistriesToCache(ids: number[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    console.log(`🔄 Sincronizando ${ids.length} registros a cache...`);
    
    for (const id of ids) {
      try {
        const synced = await this.syncRegistryToCache(id);
        if (synced) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error sincronizando registro ${id}:`, error);
        failed++;
      }
    }

    console.log(`✅ Sincronización completa: ${success} éxitos, ${failed} fallos`);
    return { success, failed };
  }

  // ========== MÉTODO PARA LIMPIAR CACHE ==========
  static async clearCache(): Promise<boolean> {
    try {
      console.log("🧹 Limpiando cache SQLite...");
      
      // Necesitarías implementar un método clearAll en RegistersCacheService
      // Por ahora, podemos eliminar todos los registros
      const db = (RegistersCacheService as any).db;
      const stmt = db.prepare("DELETE FROM ControlRegister");
      const result = stmt.run();
      
      console.log(`✅ Cache limpiado: ${result.changes} registros eliminados`);
      return true;
    } catch (error) {
      console.error("Error limpiando cache:", error);
      return false;
    }
  }

  // ========== MÉTODOS AUXILIARES PRIVADOS PARA SINCRONIZACIÓN ==========
  
  private static async syncResultsToCache(results: any[]): Promise<void> {
    try {
      console.log(`🔄 Sincronizando ${results.length} registros a SQLite cache...`);
      
      for (const result of results) {
        await this.syncSingleToCache(result);
      }
      
      console.log(`✅ ${results.length} registros sincronizados a cache`);
    } catch (error) {
      console.error("Error en syncResultsToCache:", error);
      // No lanzamos error para no afectar la respuesta principal
    }
  }
  
  private static async syncSingleToCache(registry: any): Promise<void> {
    try {
      // Verificar si ya existe en cache
      const existing = await RegistersCacheService.getRegistryById(registry.id);
      
      if (existing) {
        // Actualizar - CONVERTIR FECHAS PRIMERO
        const dataWithConvertedDates = { ...registry };
        // Convertir fechas Date a strings ISO
        if (dataWithConvertedDates.fecha instanceof Date) {
          dataWithConvertedDates.fecha = dataWithConvertedDates.fecha.toISOString();
        }
        if (dataWithConvertedDates.licencia_vencimiento instanceof Date) {
          dataWithConvertedDates.licencia_vencimiento = dataWithConvertedDates.licencia_vencimiento.toISOString();
        }
        if (dataWithConvertedDates.c_matriculacion_venc instanceof Date) {
          dataWithConvertedDates.c_matriculacion_venc = dataWithConvertedDates.c_matriculacion_venc.toISOString();
        }
        if (dataWithConvertedDates.seguro_venc instanceof Date) {
          dataWithConvertedDates.seguro_venc = dataWithConvertedDates.seguro_venc.toISOString();
        }
        if (dataWithConvertedDates.rto_venc instanceof Date) {
          dataWithConvertedDates.rto_venc = dataWithConvertedDates.rto_venc.toISOString();
        }
        if (dataWithConvertedDates.tacografo_venc instanceof Date) {
          dataWithConvertedDates.tacografo_venc = dataWithConvertedDates.tacografo_venc.toISOString();
        }
        
        await RegistersCacheService.updateRegistry(registry.id, dataWithConvertedDates);
      } else {
        // Crear
        const cacheData: dataControl = {
          userId: registry.userId,
          agente: registry.agente,
          fecha: registry.fecha instanceof Date ? registry.fecha.toISOString() : registry.fecha,
          lugar: registry.lugar,
          conductor_nombre: registry.conductor_nombre,
          licencia_tipo: registry.licencia_tipo,
          licencia_numero: registry.licencia_numero,
          licencia_vencimiento: registry.licencia_vencimiento?.toISOString() || '',
          empresa_select: registry.empresa_select,
          dominio: registry.dominio,
          interno: registry.interno,
          c_matriculacion_venc: registry.c_matriculacion_venc instanceof Date ? registry.c_matriculacion_venc.toISOString() : registry.c_matriculacion_venc,
          c_matriculacion_cert: registry.c_matriculacion_cert,
          seguro_venc: registry.seguro_venc instanceof Date ? registry.seguro_venc.toISOString() : registry.seguro_venc,
          seguro_cert: registry.seguro_cert,
          rto_venc: registry.rto_venc instanceof Date ? registry.rto_venc.toISOString() : registry.rto_venc,
          rto_cert: registry.rto_cert,
          tacografo_venc: registry.tacografo_venc instanceof Date ? registry.tacografo_venc.toISOString() : registry.tacografo_venc,
          tacografo_cert: registry.tacografo_cert,
        };
        
        await RegistersCacheService.createNewRegisterWithId(registry.id, cacheData);
      }
    } catch (error) {
      console.error(`Error sincronizando registro ${registry.id} a cache:`, error);
    }
  }

  // ========== MÉTODO PARA OBTENER ESTADÍSTICAS CON CACHE ==========
  static async getStatistics(): Promise<any> {
    try {
      console.log("📊 Obteniendo estadísticas...");
      
      // Obtener estadísticas básicas
      const totalRegistries = await prisma.controlRegister.count();
      const totalWithCertificates = await prisma.controlRegister.count({
        where: {
          OR: [
            { c_matriculacion_cert: { not: null } },
            { seguro_cert: { not: null } },
            { rto_cert: { not: null } },
            { tacografo_cert: { not: null } },
          ],
        },
      });

      // Contar por tipo de licencia
      const licenseStats = await prisma.controlRegister.groupBy({
        by: ['licencia_tipo'],
        _count: {
          licencia_tipo: true,
        },
      });

      // Últimos registros creados
      const recentRegistries = await prisma.controlRegister.findMany({
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          conductor_nombre: true,
          empresa_select: true,
          createdAt: true,
        },
      });

      return {
        totalRegistries,
        totalWithCertificates,
        percentageWithCertificates: totalRegistries > 0 
          ? Math.round((totalWithCertificates / totalRegistries) * 100) 
          : 0,
        licenseStats: licenseStats.map(stat => ({
          type: stat.licencia_tipo,
          count: stat._count.licencia_tipo,
        })),
        recentRegistries,
        cacheEnabled: true,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      throw new Error("No se pudieron obtener las estadísticas");
    }
  }
}