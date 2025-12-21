import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService.js';

export class StatsController {
  private statsService: StatsService;

  constructor() {
    this.statsService = new StatsService();
  }

  async getUserStats(req: Request, res: Response) {
    try {
      // Obtener el userId desde res.locals (que viene del middleware attachUserData)
      const userId = res.locals.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      
      const stats = await this.statsService.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error en getUserStats:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }

  async renderStatsPage(req: Request, res: Response) {
    try {
      // Obtener el userId desde res.locals
      const userId = res.locals.user?.id;
      
      if (!userId) {
        // Redirigir al login si no está autenticado
        return res.redirect('/login-user');
      }
      
      const stats = await this.statsService.getUserStats(userId);
      res.render('statistics', { 
        title: 'Estadísticas', 
        stats,
        user: res.locals.user 
      });
    } catch (error) {
      console.error('Error en renderStatsPage:', error);
      res.status(500).render('error', { 
        error: 'Error al cargar las estadísticas' 
      });
    }
  }
}