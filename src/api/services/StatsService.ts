import prisma  from '../../config/prisma.client.js';
import { CertificateType } from '@prisma/client';

export class StatsService {
  async getUserStats(userId: number) {
    console.log(`🔍 [StatsService] Obteniendo estadísticas para usuario ID: ${userId}`);
    
    // Estadísticas básicas del usuario
    const totalRegistries = await prisma.controlRegister.count({
      where: { userId, isDeleted: false }
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
          AND "isDeleted" = false -- <--- AGREGAR ESTA LÍNEA
          AND "fecha" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "fecha")
        ORDER BY DATE_TRUNC('month', "fecha") ASC
    `;

      console.log('📊 Registros por mes (RAW SQL):', rawData);
      
      // Convertir a formato esperado
      registriesByMonth = rawData.reduce((acc, item) => {
        if (item.month_key) {
          acc[item.month_key] = Number(item.count);
        }
        return acc;
      }, {});
      
    } catch (error) {
      console.error('Error en consulta raw SQL:', error);
      
      // SOLUCIÓN 2: Usar groupBy tradicional (backup)
      const backupData = await prisma.controlRegister.groupBy({
        by: ['fecha'],
        where: {
          userId,
          isDeleted: false,
          fecha: { gte: sixMonthsAgo }
        },
        _count: true
      });
      
      console.log('📊 Registros por mes (Backup):', backupData);
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
        licencia: await this.getProximosVencimientos(userId, 'licencia_vencimiento', thirtyDaysFromNow),
        c_matriculacion: await this.getProximosVencimientos(userId, 'c_matriculacion_venc', thirtyDaysFromNow),
        seguro: await this.getProximosVencimientos(userId, 'seguro_venc', thirtyDaysFromNow),
        rto: await this.getProximosVencimientos(userId, 'rto_venc', thirtyDaysFromNow),
        tacografo: await this.getProximosVencimientos(userId, 'tacografo_venc', thirtyDaysFromNow)
      },
      vencidos: {
        licencia: await this.getVencidos(userId, 'licencia_vencimiento'),
        c_matriculacion: await this.getVencidos(userId, 'c_matriculacion_venc'),
        seguro: await this.getVencidos(userId, 'seguro_venc'),
        rto: await this.getVencidos(userId, 'rto_venc'),
        tacografo: await this.getVencidos(userId, 'tacografo_venc')
      }
    };

    console.log('📅 Vencimientos:', vencimientos);

    // Estadísticas de documentos
    const documentosStats = await this.getDocumentosStats(userId);
    console.log('📄 Estadísticas de documentos:', documentosStats);

    // Distribución por empresa
    const distribucionEmpresas = await prisma.controlRegister.groupBy({
      by: ['empresa_select'],
      where: { userId, isDeleted:false },
      _count: true,
      orderBy: {
        _count: { empresa_select: 'desc' }
      },
      take: 5
    });

    // Distribución por lugar
    const distribucionLugares = await prisma.controlRegister.groupBy({
      by: ['lugar'],
      where: { userId, isDeleted: false },
      _count: true,
      orderBy: {
        _count: { lugar: 'desc' }
      },
      take: 5
    });

    console.log('🏢 Distribución empresas:', distribucionEmpresas);
    console.log('📍 Distribución lugares:', distribucionLugares);

    const resultado = {
      totalRegistries,
      registriesByMonth,
      vencimientos,
      documentos: documentosStats,
      distribuciones: {
        empresas: distribucionEmpresas,
        lugares: distribucionLugares
      },
      resumenVencimientos: this.getResumenVencimientos(vencimientos)
    };

    console.log('✅ Resultado final:', resultado);
    return resultado;
  }

  private async getProximosVencimientos(userId: number, field: string, limitDate: Date) {
    try {
      const count = await prisma.controlRegister.count({
        where: {
          userId,
          isDeleted: false,
          [field]: {
            gte: new Date(),
            lte: limitDate
          }
        }
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
      const count = await prisma.controlRegister.count({
        where: {
          userId,
          [field]: {
            lt: new Date()
          }
        }
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
          control: { userId }
        },
        select: {
          certificateType: true,
          fileSize: true
        }
      });

      console.log(`📄 Documentos encontrados: ${documentos.length}`);
      
      const totalDocumentos = documentos.length;
      const espacioTotal = documentos.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
      
      // Crear un objeto con conteo por tipo
      const porTipo: Record<string, number> = {};
      
      // Inicializar todos los tipos en 0
      Object.values(CertificateType).forEach(tipo => {
        porTipo[tipo] = 0;
      });
      
      // Contar documentos por tipo
      documentos.forEach(doc => {
        porTipo[doc.certificateType] = (porTipo[doc.certificateType] || 0) + 1;
      });

      // Filtrar tipos que tienen valor > 0 (para mostrar solo los que tienen datos)
      const porTipoFiltrado = Object.entries(porTipo).reduce((acc, [key, value]) => {
        if (value > 0) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        total: totalDocumentos,
        espacioTotalMB: Math.round((espacioTotal / (1024 * 1024)) * 100) / 100,
        porTipo: porTipoFiltrado,
        porTipoCompleto: porTipo // Mantener todos para debug
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de documentos:', error);
      return {
        total: 0,
        espacioTotalMB: 0,
        porTipo: {}
      };
    }
  }

  private formatMonthlyData(data: any[]) {
    console.log(`🔄 Formateando datos mensuales:`, data);
    
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const result: Record<string, number> = {};
    
    data.forEach((item, index) => {
      console.log(`📅 Item ${index}:`, item);
      
      if (item.fecha) {
        try {
          const fecha = new Date(item.fecha);
          console.log(`📅 Fecha parseada:`, fecha);
          console.log(`📅 Es válida?:`, !isNaN(fecha.getTime()));
          
          if (!isNaN(fecha.getTime())) {
            const key = `${meses[fecha.getMonth()]}-${fecha.getFullYear()}`;
            console.log(`📅 Key generada: ${key}`);
            result[key] = item._count;
          } else {
            console.log(`⚠️ Fecha inválida`);
          }
        } catch (error) {
          console.error(`Error parseando fecha:`, error);
        }
      } else {
        console.log(`⚠️ item.fecha es null/undefined`);
      }
    });
    
    console.log(`✅ Resultado formateado:`, result);
    return result;
  }

  private getResumenVencimientos(vencimientos: any) {
    const valoresProximos = Object.values(vencimientos.proximos) as number[];
    const valoresVencidos = Object.values(vencimientos.vencidos) as number[];
    
    const totalProximos = valoresProximos.reduce((sum: number, count: number) => sum + count, 0);
    const totalVencidos = valoresVencidos.reduce((sum: number, count: number) => sum + count, 0);
    
    return {
      totalProximos,
      totalVencidos,
      estado: totalVencidos > 0 ? 'critico' : totalProximos > 0 ? 'advertencia' : 'bueno'
    };
  }

  // Método alternativo: generar datos de prueba para desarrollo
  generateMockStats() {
    const today = new Date();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Generar datos de prueba para los últimos 6 meses
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
        proximos: {
          licencia: 2,
          c_matriculacion: 1,
          seguro: 0,
          rto: 3,
          tacografo: 1
        },
        vencidos: {
          licencia: 0,
          c_matriculacion: 0,
          seguro: 1,
          rto: 0,
          tacografo: 0
        }
      },
      documentos: {
        total: 6,
        espacioTotalMB: 1.91,
        porTipo: {
          'C_MATRICULACION': 2,
          'SEGURO': 1,
          'RTO': 2,
          'TACOGRAFO': 1
        }
      },
      distribuciones: {
        empresas: [
          { empresa_select: 'Crucero del Norte', _count: 5 },
          { empresa_select: 'La Nueva Fournier', _count: 3 }
        ],
        lugares: [
          { lugar: 'Avellaneda', _count: 4 },
          { lugar: 'Villa Ocampo', _count: 2 }
        ]
      },
      resumenVencimientos: {
        totalProximos: 7,
        totalVencidos: 1,
        estado: 'advertencia'
      }
    };
  }
}