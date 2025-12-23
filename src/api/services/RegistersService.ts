import { ControlRegister } from "@prisma/client";
import prisma from "../../config/prisma.client.js";
import { dataControl, PaginationResult } from "../../dto/control.dto.js";
import { RegistersCacheService } from "./RegistersCacheService.js";
import { DocumentCacheService } from "./DocumentCacheService.js";
import { deleteFromCloudinary } from "../../config/cloudinary.config.js";

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
      await RegistersCacheService.ensureTableStructure?.();
      // ESTRATEGIA CACHE-FIRST
      console.log("🔍 Consultando SQLite cache primero...");
      const cacheResult = await RegistersCacheService.getAllRegistries(page, limit);

      if (cacheResult.data && cacheResult.data.length > 0) {
        console.log(`✅ ${cacheResult.data.length} registros obtenidos desde cache SQLite`);
        return cacheResult;
      }

      const firstItem = cacheResult.data[0];
      if (firstItem && firstItem.certificates && Array.isArray(firstItem.certificates)) {
        console.log("📄 Datos del cache ya incluyen documentos");
        return cacheResult;
      }

      console.log("📦 Cache vacío, consultando PostgreSQL...");

      // Si no hay en cache, consultar PostgreSQL
      const skip = (page - 1) * limit;
      const totalRecords = await prisma.controlRegister.count({ where: { isDeleted: false } });

      const results = await prisma.controlRegister.findMany({
        where: { isDeleted: false },
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
          fecha: data.fecha ? new Date(data.fecha) : null,
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
          c_matriculacion_venc: data.c_matriculacion_venc ? new Date(data.c_matriculacion_venc) : null,
          c_matriculacion_cert: data.c_matriculacion_cert ?? null,
          seguro_venc: data.seguro_venc ? new Date(data.seguro_venc) : null,
          seguro_cert: data.seguro_cert ?? null,
          rto_venc: data.rto_venc ? new Date(data.rto_venc) : null,
          rto_cert: data.rto_cert ?? null,
          tacografo_venc: data.tacografo_venc ? new Date(data.tacografo_venc) : null,
          tacografo_cert: data.tacografo_cert ?? null,
        } as any,
      });

      console.log(`✅ Registro creado en PostgreSQL con ID: ${newRegister.id}`);

      // LUEGO: Crear en SQLite cache con el ID real
      console.log("➕ Creando registro en SQLite cache...");
      try {
        await RegistersCacheService.createNewRegisterWithId(newRegister.id, {
          ...data,
          isDeleted: 0
        } as any);
        console.log(`✅ Registro sincronizado a cache con ID: ${newRegister.id}`);
      } catch (cacheError) {
        console.error("⚠️ Error al sincronizar con cache (continuando):", cacheError);
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
          isDeleted: true,
          deletedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!registry || registry.isDeleted) {
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

      // LUEGO: Sincronizar a SQLite
      await this.syncSingleToCache(updatedRegistry);

      return updatedRegistry;

    } catch (error) {
      console.error("Error al actualizar registro:", error);
      throw new Error("No se pudo actualizar el registro");
    }
  }

  static async deleteRegistry(controlId: number) {
    try {
      console.log(`🗑️ Eliminando registro ${controlId}...`);

      // 1. Borrar documentos de Cloudinary
      const certificates = await prisma.certificateDocument.findMany({
        where: { controlId }
      });

      for (const cert of certificates) {
        if (cert.publicId) {
          await deleteFromCloudinary(cert.publicId);
        }
      }

      // 2. Borrar de PostgreSQL
      await prisma.controlRegister.delete({
        where: { id: controlId }
      });

      // 3. Borrar de cache SQLite - AGREGAR ESTO:
      try {
        // Usa la conexión directa a SQLite
        const { sqliteCacheSync } = await import("../../cache/SqliteCache.js");
        const db = sqliteCacheSync.getConnection();

        // Borra control
        const deleteControl = db.prepare("DELETE FROM ControlRegister WHERE id = ?");
        deleteControl.run(controlId);

        // Borra certificados
        const deleteCerts = db.prepare("DELETE FROM CertificateDocument WHERE controlId = ?");
        deleteCerts.run(controlId);

        console.log(`✅ Borrado de cache completado para ${controlId}`);
      } catch (cacheError) {
        console.error("⚠️ Error en cache:", cacheError);
      }

      return true;
    } catch (err) {
      console.error("Error:", err);
      throw new Error("No se pudo eliminar");
    }
  }


  // ========== VERIFICAR ESTADO DE CERTIFICADOS ==========
  static async checkCertificatesStatus(id: number) {
    try {
      const cacheStatus = await RegistersCacheService.checkCertificatesStatus(id);
      if (cacheStatus !== null) {
        console.log(`✅ Estado de certificados ${id} desde cache`);
        return cacheStatus;
      }

      console.log(`🔍 Estado de certificados ${id} no en cache, consultando PostgreSQL...`);

      const controlRegister = await prisma.controlRegister.findUnique({
        where: { id },
        select: {
          id: true,
          c_matriculacion_cert: true,
          seguro_cert: true,
          rto_cert: true,
          tacografo_cert: true,
          isDeleted: true
        },
      });

      if (!controlRegister || controlRegister.isDeleted) {
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
      const cacheNumbers = await RegistersCacheService.getCertificateNumbersById(id);
      if (cacheNumbers) {
        console.log(`✅ Números de certificado ${id} desde cache`);
        return cacheNumbers;
      }

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
      // Intentamos usar el método delete del cache service si existe, sino mediante comando directo
      const result = await RegistersCacheService.deleteRegistry(0); // Borrado dummy para probar conexión o implementar método específico
      console.log(`✅ Intento de limpieza de cache realizado`);
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
    }
  }

  private static async syncSingleToCache(registry: any): Promise<void> {
    try {
      // Obtener documentos asociados desde PostgreSQL
      const certificates = await prisma.certificateDocument.findMany({
        where: {
          controlId: registry.id,
          isDeleted: false
        },
        select: {
          id: true,
          certificateType: true,
          certificateNumber: true,
          fileName: true,
          mimeType: true,
          uploadedAt: true,
          description: true,
          filePath: true,
          publicId: true
        },
        orderBy: {
          uploadedAt: "desc",
        },
      });

      // Calcular documentSummary
      const documentSummary = {
        total: certificates.length,
        types: certificates.map((cert: any) => cert.certificateType),
        byType: {
          C_MATRICULACION: certificates.filter(
            (cert: any) => cert.certificateType === "C_MATRICULACION",
          ).length,
          SEGURO: certificates.filter(
            (cert: any) => cert.certificateType === "SEGURO",
          ).length,
          RTO: certificates.filter(
            (cert: any) => cert.certificateType === "RTO",
          ).length,
          TACOGRAFO: certificates.filter(
            (cert: any) => cert.certificateType === "TACOGRAFO",
          ).length,
        },
        latestDocument: certificates.length > 0 ? certificates[0] : null,
      };

      const cacheData: any = {
        // Campos básicos
        id: registry.id,
        userId: registry.userId,
        agente: registry.agente,
        fecha: registry.fecha instanceof Date ? registry.fecha.toISOString() : registry.fecha,
        lugar: registry.lugar,
        conductor_nombre: registry.conductor_nombre,
        licencia_tipo: registry.licencia_tipo,
        licencia_numero: registry.licencia_numero,
        licencia_vencimiento: registry.licencia_vencimiento instanceof Date ? registry.licencia_vencimiento.toISOString() : registry.licencia_vencimiento,
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
        isDeleted: registry.isDeleted ? 1 : 0,
        deletedAt: registry.deletedAt instanceof Date ? registry.deletedAt.toISOString() : registry.deletedAt,
        createdAt: registry.createdAt instanceof Date ? registry.createdAt.toISOString() : registry.createdAt,
        updatedAt: registry.updatedAt instanceof Date ? registry.updatedAt.toISOString() : registry.updatedAt,

        // INCLUIR DOCUMENTOS Y RESUMEN
        certificates: JSON.stringify(certificates), // Serializar array a JSON
        documentSummary: JSON.stringify(documentSummary), // Serializar objeto a JSON

        // Información del usuario
        user: JSON.stringify(registry.user || {
          id: registry.userId,
          name: '',
          email: ''
        })
      };

      // Intentar actualizar, si no existe, crear.
      const success = await RegistersCacheService.updateRegistry(registry.id, cacheData);
      if (!success) {
        await RegistersCacheService.createNewRegisterWithId(registry.id, cacheData);
      }
    } catch (error) {
      console.error(`Error sincronizando registro ${registry.id} a cache:`, error);
    }
  }

  // ========== MÉTODO PARA OBTENER ESTADÍSTICAS ==========
  static async getStatistics(): Promise<any> {
    try {
      console.log("📊 Obteniendo estadísticas...");
      const totalRegistries = await prisma.controlRegister.count({ where: { isDeleted: false } });
      const totalWithCertificates = await prisma.controlRegister.count({
        where: {
          isDeleted: false,
          OR: [
            { c_matriculacion_cert: { not: null } },
            { seguro_cert: { not: null } },
            { rto_cert: { not: null } },
            { tacografo_cert: { not: null } },
          ],
        },
      });

      const licenseStats = await prisma.controlRegister.groupBy({
        by: ['licencia_tipo'],
        where: { isDeleted: false },
        _count: { licencia_tipo: true },
      });

      const recentRegistries = await prisma.controlRegister.findMany({
        where: { isDeleted: false },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, conductor_nombre: true, empresa_select: true, createdAt: true },
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