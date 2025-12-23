// stats/services/StatsDetailService.ts
import prisma from "../../config/prisma.client.js";
import { CertificateType } from "@prisma/client";

export class StatsDetailService {
  // Método para obtener registros por tipo de vencimiento
  async getVencimientosDetail(
    userId: number,
    tipo: string,
    estado: "proximos" | "vencidos",
  ) {
    console.log(
      `🔍 [StatsDetailService] Obteniendo detalle de ${tipo} - ${estado} para usuario ID: ${userId}`,
    );

    // Mapear tipo a campo de la base de datos
    const fieldMap: Record<string, string> = {
      licencia: "licencia_vencimiento",
      c_matriculacion: "c_matriculacion_venc",
      seguro: "seguro_venc",
      rto: "rto_venc",
      tacografo: "tacografo_venc",
    };

    const fieldName = fieldMap[tipo];
    if (!fieldName) {
      throw new Error(`Tipo de vencimiento no válido: ${tipo}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);

    const whereClause: any = {
      userId,
      isDeleted: false,
    };

    // Configurar filtro según estado
    if (estado === "proximos") {
      whereClause[fieldName] = {
        gte: new Date(),
        lte: thirtyDaysFromNow,
      };
    } else {
      // vencidos
      whereClause[fieldName] = {
        lt: new Date(),
      };
    }

    // Obtener registros con información relevante
    const registros = await prisma.controlRegister.findMany({
      where: whereClause,
      select: {
        id: true,
        interno: true,
        dominio: true,
        empresa_select: true,
        conductor_nombre: true,
        licencia_numero: true, // Usado como documento del conductor
        [fieldName]: true,
        // Campos específicos para cada tipo
        ...(tipo === "c_matriculacion" && {
          c_matriculacion_cert: true,
        }),
        ...(tipo === "seguro" && {
          seguro_cert: true,
        }),
        ...(tipo === "rto" && {
          rto_cert: true,
        }),
        ...(tipo === "tacografo" && {
          tacografo_cert: true,
        }),
      },
      orderBy: {
        [fieldName]: "asc",
      },
    });

    // ✅ OPTIMIZACIÓN: Obtener TODOS los documentos relevantes de una vez
    const idsRegistros = registros.map((r) => r.id);
    const tipoMap: Record<string, string> = {
      c_matriculacion: "C_MATRICULACION",
      seguro: "SEGURO",
      rto: "RTO",
      tacografo: "TACOGRAFO",
    };

    const certificateType = tipoMap[tipo];
    let documentosPorControl: Record<number, boolean> = {};

    if (certificateType && idsRegistros.length > 0) {
      try {
        const documentos = await prisma.certificateDocument.findMany({
          where: {
            controlId: { in: idsRegistros },
            certificateType: certificateType as any,
          },
          select: {
            controlId: true,
          },
        });

        // Crear mapa de controlId -> tieneDocumento
        documentosPorControl = documentos.reduce(
          (map, doc) => {
            map[doc.controlId] = true;
            return map;
          },
          {} as Record<number, boolean>,
        );

        console.log(
          `📄 Documentos encontrados para tipo ${tipo}: ${Object.keys(documentosPorControl).length}`,
        );
      } catch (error) {
        console.error("Error obteniendo documentos:", error);
      }
    }

    // Ahora procesar registros SIN await dentro del map
    const registrosFormateados = registros
      .map((registro) => {
        const vencimiento = registro[
          fieldName as keyof typeof registro
        ] as Date | null;

        if (!vencimiento) {
          return null;
        }

        const diasRestantes =
          estado === "proximos"
            ? Math.ceil(
                (vencimiento.getTime() - today.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null;

        let numeroCertificado = "N/A";
        if (tipo === "c_matriculacion" && registro.c_matriculacion_cert) {
          numeroCertificado = registro.c_matriculacion_cert;
        } else if (tipo === "seguro" && registro.seguro_cert) {
          numeroCertificado = registro.seguro_cert;
        } else if (tipo === "rto" && registro.rto_cert) {
          numeroCertificado = registro.rto_cert;
        } else if (tipo === "tacografo" && registro.tacografo_cert) {
          numeroCertificado = registro.tacografo_cert;
        }

        // ✅ Ahora podemos acceder directamente al mapa
        const tieneDocumento = !!documentosPorControl[registro.id];

        return {
          id: registro.id,
          interno: registro.interno || "N/A",
          dominio: registro.dominio || "N/A",
          empresa: registro.empresa_select || "N/A",
          conductor: registro.conductor_nombre || "N/A",
          documentoConductor: registro.licencia_numero || "N/A",
          vencimiento: vencimiento,
          vencimientoFormateado: vencimiento.toLocaleDateString("es-AR"),
          diasRestantes,
          numeroCertificado,
          tieneDocumento,
          puedeSubirDocumento: !tieneDocumento,
          necesitaRenovacion:
            estado === "vencidos" ||
            (estado === "proximos" && diasRestantes && diasRestantes <= 7),
        };
      })
      .filter((item) => item !== null);

    console.log(
      `📋 Encontrados ${registrosFormateados.length} registros de ${tipo} ${estado}`,
    );

    return {
      tipo,
      estado,
      total: registrosFormateados.length,
      registros: registrosFormateados,
      titulo: this.getTitulo(tipo, estado),
    };
  }

  // Método para obtener documentos por tipo
  async getDocumentosDetail(userId: number, tipoDocumento: string) {
    console.log(
      `📄 [StatsDetailService] Obteniendo detalle de documentos tipo: ${tipoDocumento}`,
    );

    // Convertir tipoDocumento a formato CertificateType
    let certificateType: CertificateType;
    try {
      certificateType = tipoDocumento as CertificateType;
    } catch {
      throw new Error(`Tipo de documento no válido: ${tipoDocumento}`);
    }

    // Obtener documentos con información del registro relacionado
    const documentos = await prisma.certificateDocument.findMany({
      where: {
        certificateType: certificateType,
        control: { userId },
      },
      include: {
        control: {
          select: {
            id: true,
            interno: true,
            dominio: true,
            empresa_select: true,
            conductor_nombre: true,
          },
        },
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    // Formatear resultados
    const documentosFormateados = documentos.map((doc) => ({
      id: doc.id,
      controlId: doc.controlId,
      tipo: doc.certificateType,
      nombreArchivo: doc.fileName,
      tamaño: `${Math.round(doc.fileSize / 1024)} KB`,
      fechaSubida: doc.uploadedAt,
      fechaSubidaFormateada: doc.uploadedAt.toLocaleDateString("es-AR"),
      // Datos del registro relacionado
      interno: doc.control?.interno || "N/A",
      dominio: doc.control?.dominio || "N/A",
      empresa: doc.control?.empresa_select || "N/A",
      conductor: doc.control?.conductor_nombre || "N/A",
      numeroCertificado: doc.certificateNumber || "N/A",
    }));

    return {
      tipo: tipoDocumento,
      total: documentosFormateados.length,
      documentos: documentosFormateados,
      titulo: this.getTituloDocumento(tipoDocumento),
    };
  }

  // Método para obtener top empresas con detalle
  async getTopEmpresasDetail(userId: number) {
    const empresas = await prisma.controlRegister.groupBy({
      by: ["empresa_select"],
      where: { userId, isDeleted: false },
      _count: true,
      orderBy: {
        _count: { empresa_select: "desc" },
      },
    });

    // Para cada empresa, obtener sus registros
    const empresasConDetalle = await Promise.all(
      empresas.map(async (empresa) => {
        const registros = await prisma.controlRegister.findMany({
          where: {
            userId,
            isDeleted: false,
            empresa_select: empresa.empresa_select,
          },
          select: {
            id: true,
            interno: true,
            dominio: true,
            conductor_nombre: true,
            fecha: true,
          },
          take: 10, // Limitar para no sobrecargar
          orderBy: {
            fecha: "desc",
          },
        });

        return {
          nombre: empresa.empresa_select || "Sin empresa",
          cantidad: empresa._count,
          registros: registros.map((r) => ({
            id: r.id,
            interno: r.interno || "N/A",
            dominio: r.dominio || "N/A",
            conductor: r.conductor_nombre || "N/A",
            fecha: r.fecha?.toLocaleDateString("es-AR") || "N/A",
          })),
        };
      }),
    );

    return {
      titulo: "Detalle por Empresa",
      totalEmpresas: empresasConDetalle.length,
      empresas: empresasConDetalle,
    };
  }

  // Método para obtener top lugares con detalle
  async getTopLugaresDetail(userId: number) {
    const lugares = await prisma.controlRegister.groupBy({
      by: ["lugar"],
      where: { userId, isDeleted: false },
      _count: true,
      orderBy: {
        _count: { lugar: "desc" },
      },
    });

    const lugaresConDetalle = await Promise.all(
      lugares.map(async (lugar) => {
        const registros = await prisma.controlRegister.findMany({
          where: {
            userId,
            isDeleted: false,
            lugar: lugar.lugar,
          },
          select: {
            id: true,
            interno: true,
            dominio: true,
            empresa_select: true,
            fecha: true,
          },
          take: 10,
          orderBy: {
            fecha: "desc",
          },
        });

        return {
          nombre: lugar.lugar || "Sin lugar",
          cantidad: lugar._count,
          registros: registros.map((r) => ({
            id: r.id,
            interno: r.interno || "N/A",
            dominio: r.dominio || "N/A",
            empresa: r.empresa_select || "N/A",
            fecha: r.fecha?.toLocaleDateString("es-AR") || "N/A",
          })),
        };
      }),
    );

    return {
      titulo: "Detalle por Lugar",
      totalLugares: lugaresConDetalle.length,
      lugares: lugaresConDetalle,
    };
  }

  // Métodos auxiliares para títulos
  private getTitulo(tipo: string, estado: string): string {
    const tipoMap: Record<string, string> = {
      licencia: "Licencia",
      c_matriculacion: "Certificado de Matriculación",
      seguro: "Seguro",
      rto: "RTO",
      tacografo: "Tacógrafo",
    };

    const estadoMap: Record<string, string> = {
      proximos: "Próximos a Vencer",
      vencidos: "Vencidos",
    };

    return `${tipoMap[tipo]} - ${estadoMap[estado]}`;
  }

  private getTituloDocumento(tipo: string): string {
    const tipoMap: Record<string, string> = {
      C_MATRICULACION: "Certificados de Matriculación",
      SEGURO: "Seguros",
      RTO: "RTOs",
      TACOGRAFO: "Tacógrafos",
    };

    return `Documentos de ${tipoMap[tipo] || tipo}`;
  }
}
