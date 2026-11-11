const PersonaModel = require('../models/persona.model');

class DashboardController {
  /**
   * Vista principal del Dashboard con métricas y KPIs
   */
  static async index(req, res) {
    try {
      const kpis = await PersonaModel.getKpis();

      return res.render('dashboard/index', {
        title: 'Dashboard de Seguimiento y KPIs',
        currentUser: req.user,
        kpis,
        path: '/dashboard'
      });
    } catch (error) {
      console.error('[Dashboard Error]:', error);
      return res.render('dashboard/index', {
        title: 'Dashboard de Seguimiento y KPIs',
        currentUser: req.user,
        kpis: {
          total: 0,
          activos: 0,
          inactivos: 0,
          porSexo: { M: 0, F: 0, Otro: 0 },
          porSector: [],
          ultimosRegistros: []
        },
        alertMessage: 'No se pudieron cargar algunas métricas en este momento.',
        alertType: 'warning',
        path: '/dashboard'
      });
    }
  }
}

module.exports = DashboardController;
