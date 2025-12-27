import prisma from "../../config/prisma.client.js";
import { CertificateType } from "@prisma/client";

export class StatsService {
  async getUserStats(userId: number) {
    console.log(
      `🔍 [StatsService] Obteniendo estadísticas para usuario ID: ${userId}`,
    );

    // Estadísticas básicas del usuario
    const totalRegistries = await prisma.controlRegister.count({
      where: { userId, isDeleted: false },
    });

    console.log(`📊 Total de registros: ${totalRegistries}`);

    // Registros por mes (últimos 6 meses) - SOLUCIÓN: usar consulta raw
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1); // Primer día del mes
    sixMonthsAgo.setHours(0, 0, 0, 0);

    console.log(`📅 Buscando registros desde: ${sixMonthsAgo.toISOString()}`);

    // SOLUCIÓN 1: Usar consulta raw SQL (recomendado)
    let registriesByMonth = {};

    try {
      // Consulta SQL para agrupar por mes
      const rawData: any[] = await prisma.$queryRaw`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "fecha"), 'Mon-YYYY') as month_key,
          COUNT(*) as count
        FROM "ControlRegister"
        WHERE "userId" = ${userId}
          AND "isDeleted" = false
          AND "fecha" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "fecha")
        ORDER BY DATE_TRUNC('month', "fecha") ASC
    `;

      console.log("📊 Registros por mes (RAW SQL):", rawData);

      // Convertir a formato esperado
      registriesByMonth = rawData.reduce((acc, item) => {
        if (item.month_key) {
          acc[item.month_key] = Number(item.count);
        }
        return acc;
      }, {});
    } catch (error) {
      console.error("Error en consulta raw SQL:", error);

      // SOLUCIÓN 2: Usar groupBy tradicional (backup)
      const backupData = await prisma.controlRegister.groupBy({
        by: ["fecha"],
        where: {
          userId,
          isDeleted: false,
          fecha: { gte: sixMonthsAgo },
        },
        _count: true,
      });

      console.log("📊 Registros por mes (Backup):", backupData);
      registriesByMonth = this.formatMonthlyData(backupData);
    }

    console.log(`📈 Registros por mes formateados:`, registriesByMonth);

    // Estadísticas de vencimientos
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);

    console.log(`📅 Hoy: ${today.toISOString()}`);
    console.log(`📅 30 días desde hoy: ${thirtyDaysFromNow.toISOString()}`);

    const vencimientos = {
      proximos: {
        licencia: await this.getProximosVencimientos(
          userId,
          "licencia_vencimiento",
          thirtyDaysFromNow,
        ),
        c_matriculacion: await this.getProximosVencimientos(
          userId,
          "c_matriculacion_venc",
          thirtyDaysFromNow,
        ),
        seguro: await this.getProximosVencimientos(
          userId,
          "seguro_venc",
          thirtyDaysFromNow,
        ),
        rto: await this.getProximosVencimientos(
          userId,
          "rto_venc",
          thirtyDaysFromNow,
        ),
        tacografo: await this.getProximosVencimientos(
          userId,
          "tacografo_venc",
          thirtyDaysFromNow,
        ),
      },
      vencidos: {
        licencia: await this.getVencidos(userId, "licencia_vencimiento"),
        c_matriculacion: await this.getVencidos(userId, "c_matriculacion_venc"),
        seguro: await this.getVencidos(userId, "seguro_venc"),
        rto: await this.getVencidos(userId, "rto_venc"),
        tacografo: await this.getVencidos(userId, "tacografo_venc"),
      },
    };

    console.log("📅 Vencimientos:", vencimientos);

    // Estadísticas de documentos
    const documentosStats = await this.getDocumentosStats(userId);
    console.log("📄 Estadísticas de documentos:", documentosStats);

    // Distribución por empresa
    const distribucionEmpresas = await prisma.controlRegister.groupBy({
      by: ["empresa_select"],
      where: { userId, isDeleted: false },
      _count: true,
      orderBy: {
        _count: { empresa_select: "desc" },
      },
      take: 5,
    });

    // Distribución por lugar
    const distribucionLugares = await prisma.controlRegister.groupBy({
      by: ["lugar"],
      where: { userId, isDeleted: false },
      _count: true,
      orderBy: {
        _count: { lugar: "desc" },
      },
      take: 5,
    });

    console.log("🏢 Distribución empresas:", distribucionEmpresas);
    console.log("📍 Distribución lugares:", distribucionLugares);

    const resultado = {
      totalRegistries,
      registriesByMonth,
      vencimientos,
      documentos: documentosStats,
      distribuciones: {
        empresas: distribucionEmpresas,
        lugares: distribucionLugares,
      },
      resumenVencimientos: this.getResumenVencimientos(vencimientos),
    };

    console.log("✅ Resultado final:", resultado);
    return resultado;
  }

  private async getProximosVencimientos(
    userId: number,
    field: string,
    limitDate: Date,
  ) {
    try {
      const count = await prisma.controlRegister.count({
        where: {
          userId,
          isDeleted: false,
          [field]: {
            gte: new Date(),
            lte: limitDate,
          },
        },
      });
      console.log(`📅 ${field} próximos: ${count}`);
      return count;
    } catch (error) {
      console.error(`Error contando ${field} próximos:`, error);
      return 0;
    }
  }

  private async getVencidos(userId: number, field: string) {
    try {
      // CORRECCIÓN AQUÍ: Se agregó isDeleted: false
      const count = await prisma.controlRegister.count({
        where: {
          userId,
          isDeleted: false,
          [field]: {
            lt: new Date(),
          },
        },
      });
      console.log(`📅 ${field} vencidos: ${count}`);
      return count;
    } catch (error) {
      console.error(`Error contando ${field} vencidos:`, error);
      return 0;
    }
  }

  private async getDocumentosStats(userId: number) {
    try {
      const documentos = await prisma.certificateDocument.findMany({
        where: {
          control: { userId, isDeleted: false }, // CORRECCIÓN: Filtrar por registros no eliminados
        },
        select: {
          certificateType: true,
          fileSize: true,
        },
      });

      console.log(`📄 Documentos encontrados: ${documentos.length}`);

      const totalDocumentos = documentos.length;
      const espacioTotal = documentos.reduce(
        (sum, doc) => sum + (doc.fileSize || 0),
        0,
      );

      // Crear un objeto con conteo por tipo
      const porTipo: Record<string, number> = {};

      // Inicializar todos los tipos en 0
      Object.values(CertificateType).forEach((tipo) => {
        porTipo[tipo] = 0;
      });

      // Contar documentos por tipo
      documentos.forEach((doc) => {
        porTipo[doc.certificateType] = (porTipo[doc.certificateType] || 0) + 1;
      });

      // Filtrar tipos que tienen valor > 0 (para mostrar solo los que tienen datos)
      const porTipoFiltrado = Object.entries(porTipo).reduce(
        (acc, [key, value]) => {
          if (value > 0) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        total: totalDocumentos,
        espacioTotalMB: Math.round((espacioTotal / (1024 * 1024)) * 100) / 100,
        porTipo: porTipoFiltrado,
        porTipoCompleto: porTipo, // Mantener todos para debug
      };
    } catch (error) {
      console.error("Error obteniendo estadísticas de documentos:", error);
      return {
        total: 0,
        espacioTotalMB: 0,
        porTipo: {},
      };
    }
  }

  private formatMonthlyData(data: any[]) {
    console.log(`🔄 Formateando datos mensuales:`, data);

    const meses = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];
    const result: Record<string, number> = {};

    data.forEach((item, index) => {
      if (item.fecha) {
        try {
          const fecha = new Date(item.fecha);
          if (!isNaN(fecha.getTime())) {
            const key = `${meses[fecha.getMonth()]}-${fecha.getFullYear()}`;
            result[key] = item._count;
          }
        } catch (error) {
          console.error(`Error parseando fecha:`, error);
        }
      }
    });

    return result;
  }

  private getResumenVencimientos(vencimientos: any) {
    const valoresProximos = Object.values(vencimientos.proximos) as number[];
    const valoresVencidos = Object.values(vencimientos.vencidos) as number[];

    const totalProximos = valoresProximos.reduce(
      (sum: number, count: number) => sum + count,
      0,
    );
    const totalVencidos = valoresVencidos.reduce(
      (sum: number, count: number) => sum + count,
      0,
    );

    return {
      totalProximos,
      totalVencidos,
      estado:
        totalVencidos > 0
          ? "critico"
          : totalProximos > 0
            ? "advertencia"
            : "bueno",
    };
  }

  async getExpiringDocuments(userId: number, daysThreshold: number = 30) {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);

    try {
      const vencimientos = await prisma.controlRegister.findMany({
        where: {
          userId,
          isDeleted: false,
          OR: [
            {
              AND: [
                { c_matriculacion_venc: { not: null } },
                { c_matriculacion_venc: { lte: thresholdDate } },
                { c_matriculacion_venc: { gte: now } },
              ],
            },
            {
              AND: [
                { seguro_venc: { not: null } },
                { seguro_venc: { lte: thresholdDate } },
                { seguro_venc: { gte: now } },
              ],
            },
            {
              AND: [
                { rto_venc: { not: null } },
                { rto_venc: { lte: thresholdDate } },
                { rto_venc: { gte: now } },
              ],
            },
            {
              AND: [
                { tacografo_venc: { not: null } },
                { tacografo_venc: { lte: thresholdDate } },
                { tacografo_venc: { gte: now } },
              ],
            },
          ],
        },
        include: {
          certificates: {
            where: {
              certificateType: {
                in: ["C_MATRICULACION", "SEGURO", "RTO", "TACOGRAFO"],
              },
            },
            orderBy: {
              uploadedAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          c_matriculacion_venc: "asc",
        },
      });

      const resultados = vencimientos.map((registro) => {
        let tipoDocumento = "";
        let fechaVencimiento: Date | null = null;

        if (registro.c_matriculacion_venc && registro.c_matriculacion_venc >= now && registro.c_matriculacion_venc <= thresholdDate) {
          tipoDocumento = "C_MATRICULACION";
          fechaVencimiento = registro.c_matriculacion_venc;
        } else if (registro.seguro_venc && registro.seguro_venc >= now && registro.seguro_venc <= thresholdDate) {
          tipoDocumento = "SEGURO";
          fechaVencimiento = registro.seguro_venc;
        } else if (registro.rto_venc && registro.rto_venc >= now && registro.rto_venc <= thresholdDate) {
          tipoDocumento = "RTO";
          fechaVencimiento = registro.rto_venc;
        } else if (registro.tacografo_venc && registro.tacografo_venc >= now && registro.tacografo_venc <= thresholdDate) {
          tipoDocumento = "TACOGRAFO";
          fechaVencimiento = registro.tacografo_venc;
        }

        const documento = registro.certificates.find((cert) => cert.certificateType === tipoDocumento);

        return {
          id: registro.id,
          interno: registro.interno,
          dominio: registro.dominio,
          empresa: registro.empresa_select,
          conductor: registro.conductor_nombre,
          tipoDocumento,
          fechaVencimiento,
          fechaVencimientoFormateada: fechaVencimiento?.toLocaleDateString("es-AR"),
          diasRestantes: fechaVencimiento ? Math.ceil((fechaVencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
          tieneDocumento: !!documento,
          ultimoDocumento: documento ? { id: documento.id, fileName: documento.fileName, uploadedAt: documento.uploadedAt } : null,
        };
      });

      return resultados;
    } catch (error) {
      console.error("❌ Error obteniendo documentos próximos a vencer:", error);
      return [];
    }
  }

  generateMockStats() {
    // Este método lo mantengo tal cual por si lo usas para pruebas, 
    // pero recuerda que el controlador llama a getUserStats()
    const today = new Date();
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const registriesByMonth: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(today.getMonth() - i);
      const key = `${meses[date.getMonth()]}-${date.getFullYear()}`;
      registriesByMonth[key] = Math.floor(Math.random() * 10) + 1;
    }

    return {
      totalRegistries: 15,
      registriesByMonth,
      vencimientos: {
        proximos: { licencia: 2, c_matriculacion: 1, seguro: 0, rto: 3, tacografo: 1 },
        vencidos: { licencia: 0, c_matriculacion: 0, seguro: 1, rto: 0, tacografo: 0 },
      },
      documentos: { total: 6, espacioTotalMB: 1.91, porTipo: { C_MATRICULACION: 2, SEGURO: 1, RTO: 2, TACOGRAFO: 1 } },
      distribuciones: {
        empresas: [{ empresa_select: "Crucero del Norte", _count: 5 }, { empresa_select: "La Nueva Fournier", _count: 3 }],
        lugares: [{ lugar: "Avellaneda", _count: 4 }, { lugar: "Villa Ocampo", _count: 2 }],
      },
      resumenVencimientos: { totalProximos: 7, totalVencidos: 1, estado: "advertencia" },
    };
  }
}