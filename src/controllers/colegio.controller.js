const ColegioModel = require('../models/colegio.model');

class ColegioController {
  /**
   * Listado de Colegios Electorales con filtros y KPIs
   */
  static async index(req, res) {
    try {
      const { search = '', sector = '', municipio = '', activo = '', msg = '', type = 'info' } = req.query;

      const colegios = await ColegioModel.findAll({ search, sector, municipio, activo });

      // Obtener todos para dropdowns de filtros y métricas
      const todos = await ColegioModel.findAll();
      const sectoresUnicos = [...new Set(todos.map(c => c.sector).filter(Boolean))].sort();
      const municipiosUnicos = [...new Set(todos.map(c => c.municipio).filter(Boolean))].sort();

      // Cálculo de KPIs
      const totalColegios = todos.length;
      const colegiosActivos = todos.filter(c => c.activo).length;
      const totalMesas = todos.reduce((acc, c) => acc + (parseInt(c.mesas, 10) || 0), 0);
      const totalElectores = todos.reduce((acc, c) => acc + (parseInt(c.electores, 10) || 0), 0);

      return res.render('colegios/index', {
        title: 'Colegios Electorales',
        currentUser: req.user,
        colegios,
        sectoresUnicos,
        municipiosUnicos,
        kpis: {
          total: totalColegios,
          activos: colegiosActivos,
          mesas: totalMesas,
          electores: totalElectores
        },
        filters: { search, sector, municipio, activo },
        alertMessage: msg || null,
        alertType: type,
        path: '/colegios'
      });
    } catch (error) {
      console.error('[ColegioController index error]:', error);
      return res.render('colegios/index', {
        title: 'Colegios Electorales',
        currentUser: req.user,
        colegios: [],
        sectoresUnicos: [],
        municipiosUnicos: [],
        kpis: { total: 0, activos: 0, mesas: 0, electores: 0 },
        filters: {},
        alertMessage: 'Ocurrió un error al cargar los colegios electorales.',
        alertType: 'error',
        path: '/colegios'
      });
    }
  }

  /**
   * Vista de registro de nuevo colegio electoral
   */
  static showCreate(req, res) {
    return res.render('colegios/create', {
      title: 'Registrar Nuevo Colegio Electoral',
      currentUser: req.user,
      errors: [],
      oldInput: {},
      path: '/colegios'
    });
  }

  /**
   * Procesa la creación de un nuevo colegio electoral
   */
  static async create(req, res) {
    const { codigo, nombre, municipio, sector, direccion, mesas, electores } = req.body;

    if (req.validationErrors && req.validationErrors.length > 0) {
      return res.status(422).render('colegios/create', {
        title: 'Registrar Nuevo Colegio Electoral',
        currentUser: req.user,
        alertMessage: 'Por favor complete correctamente todos los campos obligatorios.',
        alertType: 'error',
        errors: req.validationErrors,
        oldInput: req.body,
        path: '/colegios'
      });
    }

    try {
      await ColegioModel.create({
        codigo,
        nombre,
        municipio,
        sector,
        direccion,
        mesas,
        electores
      });

      return res.redirect('/colegios?msg=' + encodeURIComponent(`Colegio Electoral "${codigo.toUpperCase()}" registrado exitosamente.`) + '&type=success');
    } catch (error) {
      console.error('[ColegioController create error]:', error);
      const isDuplicate = error.status === 409;
      return res.status(isDuplicate ? 409 : 500).render('colegios/create', {
        title: 'Registrar Nuevo Colegio Electoral',
        currentUser: req.user,
        alertMessage: error.message || 'Error al procesar el registro del colegio electoral.',
        alertType: 'error',
        errors: [],
        oldInput: req.body,
        path: '/colegios'
      });
    }
  }

  /**
   * Alterna el estado activo/inactivo de un colegio electoral
   */
  static async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const actualizado = await ColegioModel.toggleStatus(id);
      const estadoTxt = actualizado.activo ? 'activado' : 'inactivado';
      return res.redirect('/colegios?msg=' + encodeURIComponent(`El colegio electoral "${actualizado.codigo}" fue ${estadoTxt} correctamente.`) + '&type=success');
    } catch (error) {
      console.error('[ColegioController toggleStatus error]:', error);
      return res.redirect('/colegios?msg=' + encodeURIComponent('Error al modificar el estado del colegio electoral.') + '&type=error');
    }
  }
}

module.exports = ColegioController;

