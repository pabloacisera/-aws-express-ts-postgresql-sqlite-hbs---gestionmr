// stats/controllers/StatsDetailController.ts
import { Request, Response } from 'express';
import { StatsDetailService } from '../services/StatsDetailService.js';

export class StatsDetailController {
  private statsDetailService: StatsDetailService;

  constructor() {
    this.statsDetailService = new StatsDetailService();
  }

  // Método para mostrar página de detalle
  async renderVencimientoDetail(req: Request, res: Response) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) {
        return res.redirect('/login-user');
      }
      
      // Obtener y validar parámetros
      const tipo = req.params.tipo;
      const estado = req.params.estado;
      
      // Validar que existan
      if (!tipo || !estado) {
        return res.status(400).render('error', { 
          error: 'Parámetros tipo y estado son requeridos' 
        });
      }
      
      // Validar tipo
      const tiposValidos = ['licencia', 'c_matriculacion', 'seguro', 'rto', 'tacografo'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).render('error', { 
          error: 'Tipo de vencimiento no válido' 
        });
      }
      
      // Validar estado
      if (!['proximos', 'vencidos'].includes(estado)) {
        return res.status(400).render('error', { 
          error: 'Estado no válido' 
        });
      }
      
      const detalle = await this.statsDetailService.getVencimientosDetail(
        userId, 
        tipo, 
        estado as 'proximos' | 'vencidos'
      );
      
      res.render('stats_detail', {
        title: detalle.titulo,
        tipo: 'vencimiento',
        detalle,
        user: res.locals.user
      });
      
    } catch (error) {
      console.error('Error en renderVencimientoDetail:', error);
      res.status(500).render('error', {
        error: 'Error al cargar el detalle de vencimientos'
      });
    }
  }

  async renderDocumentosDetail(req: Request, res: Response) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) {
        return res.redirect('/login-user');
      }
      
      // Obtener y validar parámetro
      const tipo = req.params.tipo;
      
      if (!tipo) {
        return res.status(400).render('error', { 
          error: 'Parámetro tipo es requerido' 
        });
      }
      
      // Validar tipo de documento
      const tiposValidos = ['C_MATRICULACION', 'SEGURO', 'RTO', 'TACOGRAFO'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).render('error', { 
          error: 'Tipo de documento no válido' 
        });
      }
      
      const detalle = await this.statsDetailService.getDocumentosDetail(userId, tipo);
      
      res.render('stats_detail', {
        title: detalle.titulo,
        tipo: 'documento',
        detalle,
        user: res.locals.user
      });
      
    } catch (error) {
      console.error('Error en renderDocumentosDetail:', error);
      res.status(500).render('error', {
        error: 'Error al cargar el detalle de documentos'
      });
    }
  }

  async renderEmpresasDetail(req: Request, res: Response) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) {
        return res.redirect('/login-user');
      }
      
      const detalle = await this.statsDetailService.getTopEmpresasDetail(userId);
      
      res.render('stats_detail', {
        title: 'Detalle por Empresa',
        tipo: 'empresa',
        detalle,
        user: res.locals.user
      });
      
    } catch (error) {
      console.error('Error en renderEmpresasDetail:', error);
      res.status(500).render('error', {
        error: 'Error al cargar el detalle por empresa'
      });
    }
  }

  async renderLugaresDetail(req: Request, res: Response) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) {
        return res.redirect('/login-user');
      }
      
      const detalle = await this.statsDetailService.getTopLugaresDetail(userId);
      
      res.render('stats_detail', {
        title: 'Detalle por Lugar',
        tipo: 'lugar',
        detalle,
        user: res.locals.user
      });
      
    } catch (error) {
      console.error('Error en renderLugaresDetail:', error);
      res.status(500).render('error', {
        error: 'Error al cargar el detalle por lugar'
      });
    }
  }

  // API endpoint para obtener datos (por si necesitas AJAX)
  async getVencimientoDetailApi(req: Request, res: Response) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      
      // Obtener y validar parámetros
      const tipo = req.params.tipo;
      const estado = req.params.estado;
      
      if (!tipo || !estado) {
        return res.status(400).json({ error: 'Parámetros tipo y estado son requeridos' });
      }
      
      if (!['licencia', 'c_matriculacion', 'seguro', 'rto', 'tacografo'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo no válido' });
      }
      
      if (!['proximos', 'vencidos'].includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
      }
      
      const detalle = await this.statsDetailService.getVencimientosDetail(
        userId, 
        tipo, 
        estado as 'proximos' | 'vencidos'
      );
      
      res.json(detalle);
      
    } catch (error) {
      console.error('Error en getVencimientoDetailApi:', error);
      res.status(500).json({ error: 'Error al obtener el detalle' });
    }
  }

  async getDocumentosDetailApi(req: Request, res: Response) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      
      // Obtener y validar parámetro
      const tipo = req.params.tipo;
      
      if (!tipo) {
        return res.status(400).json({ error: 'Parámetro tipo es requerido' });
      }
      
      const detalle = await this.statsDetailService.getDocumentosDetail(userId, tipo);
      
      res.json(detalle);
      
    } catch (error) {
      console.error('Error en getDocumentosDetailApi:', error);
      res.status(500).json({ error: 'Error al obtener el detalle de documentos' });
    }
  }
}

export const statsDetailController = new StatsDetailController();