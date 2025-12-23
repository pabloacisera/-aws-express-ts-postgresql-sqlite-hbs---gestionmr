import { ControlRegister } from "@prisma/client";
import prisma from "../../config/prisma.client.js";
import { dataControl, PaginationResult } from "../../dto/control.dto.js";
import { deleteFromCloudinary } from "../../config/cloudinary.config.js";

export class RegistersService {
  // ========== MÉTODO DE BÚSQUEDA ==========
  static async searchRegistries(
    searchTerm: string,
    searchField: string = "all",
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginationResult> {
    try {
      console.log(
        `🔍 Buscando registros "${searchTerm}" en campo "${searchField}"...`,
      );

      const skip = (page - 1) * limit;
      let whereCondition: any = { isDeleted: false };

      if (searchTerm && searchTerm.trim()) {
        if (searchField === "all") {
          whereCondition.OR = [
            {
              conductor_nombre: { contains: searchTerm, mode: "insensitive" },
            },
            { empresa_select: { contains: searchTerm, mode: "insensitive" } },
            { interno: { contains: searchTerm, mode: "insensitive" } },
            { dominio: { contains: searchTerm, mode: "insensitive" } },
            { agente: { contains: searchTerm, mode: "insensitive" } },
          ];
        } else {
          // CORREGIR: Usar not: null para campos que pueden ser nulos
          whereCondition[searchField] = {
            contains: searchTerm,
            mode: "insensitive",
          };
        }
      } else {
        // Si no hay término de búsqueda, solo filtrar por no eliminados
        console.log(
          "ℹ️ Sin término de búsqueda, mostrando todos los registros",
        );
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

      return finalResult;
    } catch (error) {
      console.error("Error en búsqueda:", error);
      throw new Error("No se pudo realizar la búsqueda");
    }
  }

  // ========== MÉTODO PARA OBTENER TODOS LOS REGISTROS ==========
  static async getAllRegistries(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginationResult> {
    try {
      console.log(
        `📊 Obteniendo registros (página ${page}, límite ${limit})...`,
      );

      const skip = (page - 1) * limit;
      const totalRecords = await prisma.controlRegister.count({
        where: { isDeleted: false },
      });

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

      console.log(`✅ ${formattedResults.length} registros obtenidos`);
      return finalResult;
    } catch (error) {
      console.error("Error al obtener registros", error);
      throw new Error("No se han podido obtener registros");
    }
  }

  // ========== CREAR NUEVO REGISTRO ==========
  static async createNewRegister(data: dataControl): Promise<ControlRegister> {
    try {
      console.log("➕ Creando nuevo registro...");

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
          c_matriculacion_venc: data.c_matriculacion_venc
            ? new Date(data.c_matriculacion_venc)
            : null,
          c_matriculacion_cert: data.c_matriculacion_cert ?? null,
          seguro_venc: data.seguro_venc ? new Date(data.seguro_venc) : null,
          seguro_cert: data.seguro_cert ?? null,
          rto_venc: data.rto_venc ? new Date(data.rto_venc) : null,
          rto_cert: data.rto_cert ?? null,
          tacografo_venc: data.tacografo_venc
            ? new Date(data.tacografo_venc)
            : null,
          tacografo_cert: data.tacografo_cert ?? null,
        } as any,
      });

      console.log(`✅ Registro creado exitosamente con ID: ${newRegister.id}`);
      return newRegister;
    } catch (error) {
      console.error("Error al crear registro", error);
      throw new Error("No se ha podido crear el registro");
    }
  }

  // ========== OBTENER REGISTRO POR ID ==========
  static async getRegistryById(id: number) {
    try {
      console.log(`🔍 Buscando registro ${id}...`);

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

      console.log(`✅ Registro ${id} encontrado`);
      return registry;
    } catch (error) {
      console.error("Error al obtener registro por ID:", error);
      throw new Error("No se pudo obtener el registro");
    }
  }

  // ========== ACTUALIZAR REGISTRO ==========
  static async updateRegistry(id: number, data: any) {
    try {
      console.log(`✏️ Actualizando registro ${id}...`);

      const updatedRegistry = await prisma.controlRegister.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Registro ${id} actualizado exitosamente`);
      return updatedRegistry;
    } catch (error) {
      console.error("Error al actualizar registro:", error);
      throw new Error("No se pudo actualizar el registro");
    }
  }

  static async deleteRegistry(controlId: number) {
    try {
      console.log(`🗑️ Eliminando registro ${controlId}...`);

      // 1. Primero verificar que el registro existe y no está ya eliminado
      const control = await prisma.controlRegister.findUnique({
        where: { id: controlId },
        include: {
          certificates: true,
        },
      });

      if (!control) {
        throw new Error("Registro no encontrado");
      }

      if (control.isDeleted) {
        console.log(`⚠️ Registro ${controlId} ya está marcado como eliminado`);
        return true;
      }

      // 2. Borrar documentos de Cloudinary
      for (const cert of control.certificates) {
        if (cert.publicId) {
          try {
            await deleteFromCloudinary(cert.publicId);
            console.log(`🗑️ Documento Cloudinary eliminado: ${cert.publicId}`);
          } catch (cloudinaryError) {
            console.error("Error eliminando de Cloudinary:", cloudinaryError);
          }
        }
      }

      // 3. Eliminar documentos de la base de datos
      await prisma.certificateDocument.deleteMany({
        where: { controlId },
      });

      // 4. Ahora eliminar el registro principal con soft delete
      await prisma.controlRegister.update({
        where: { id: controlId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // 5. Opcional: Invalidar caché si estás usando RegistersCacheService
      // if (RegistersCacheService.invalidateCache) {
      //   RegistersCacheService.invalidateCache();
      // }

      console.log(
        `✅ Registro ${controlId} eliminado exitosamente (soft delete)`,
      );
      return true;
    } catch (err) {
      console.error("Error eliminando registro:", err);
      throw new Error(
        "No se pudo eliminar el registro: " + (err as Error).message,
      );
    }
  }

  // ========== VERIFICAR ESTADO DE CERTIFICADOS ==========
  static async checkCertificatesStatus(id: number) {
    try {
      console.log(
        `🔍 Verificando estado de certificados para registro ${id}...`,
      );

      const controlRegister = await prisma.controlRegister.findUnique({
        where: { id },
        select: {
          id: true,
          c_matriculacion_cert: true,
          seguro_cert: true,
          rto_cert: true,
          tacografo_cert: true,
          isDeleted: true,
        },
      });

      if (!controlRegister || controlRegister.isDeleted) {
        return null;
      }

      const cMatriculacionStatus =
        !!controlRegister.c_matriculacion_cert?.trim();
      const seguroStatus = !!controlRegister.seguro_cert?.trim();
      const rtoStatus = !!controlRegister.rto_cert?.trim();
      const tacografoStatus = !!controlRegister.tacografo_cert?.trim();

      const status = {
        id: controlRegister.id,
        c_matriculacion_cert: cMatriculacionStatus,
        seguro_cert: seguroStatus,
        rto_cert: rtoStatus,
        tacografo_cert: tacografoStatus,
        allComplete:
          cMatriculacionStatus && seguroStatus && rtoStatus && tacografoStatus,
        missingFields: [
          ...(!cMatriculacionStatus ? ["c_matriculacion_cert"] : []),
          ...(!seguroStatus ? ["seguro_cert"] : []),
          ...(!rtoStatus ? ["rto_cert"] : []),
          ...(!tacografoStatus ? ["tacografo_cert"] : []),
        ],
      };

      return status;
    } catch (err) {
      console.error("Error checking certificates status:", err);
      throw err;
    }
  }

  // ========== OBTENER NÚMEROS DE CERTIFICADOS ==========
  static async getCertificateNumbersById(id: number) {
    try {
      console.log(
        `🔍 Obteniendo números de certificado para registro ${id}...`,
      );

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

      return numbers;
    } catch (error) {
      console.error("Error al obtener números de certificado:", error);
      throw new Error("No se pudieron obtener los números de certificado");
    }
  }

  // ========== MÉTODO PARA OBTENER ESTADÍSTICAS ==========
  static async getStatistics(): Promise<any> {
    try {
      console.log("📊 Obteniendo estadísticas...");

      const totalRegistries = await prisma.controlRegister.count({
        where: { isDeleted: false },
      });
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
        by: ["licencia_tipo"],
        where: { isDeleted: false },
        _count: { licencia_tipo: true },
      });

      const recentRegistries = await prisma.controlRegister.findMany({
        where: { isDeleted: false },
        take: 5,
        orderBy: { createdAt: "desc" },
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
        percentageWithCertificates:
          totalRegistries > 0
            ? Math.round((totalWithCertificates / totalRegistries) * 100)
            : 0,
        licenseStats: licenseStats.map((stat) => ({
          type: stat.licencia_tipo,
          count: stat._count.licencia_tipo,
        })),
        recentRegistries,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      throw new Error("No se pudieron obtener las estadísticas");
    }
  }
}
