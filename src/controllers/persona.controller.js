const PersonaModel = require('../models/persona.model');
const ColegioModel = require('../models/colegio.model');

class PersonaController {
  /**
   * Listado de personas registradas con botones de acciones: Detalle, Editar, Activar/Inactivar
   */
  static async index(req, res) {
    try {
      const { search = '', sector = '', sexo = '', activo = '', verificado = '', msg = '', type = 'info' } = req.query;

      const personas = await PersonaModel.findAll({ search, sector, sexo, activo, verificado });

      // Extraer lista de sectores únicos para los filtros del dropdown
      const todosLosRegistros = await PersonaModel.findAll();
      const sectoresUnicos = [...new Set(todosLosRegistros.map(p => p.sector).filter(Boolean))].sort();

      return res.render('personas/index', {
        title: 'Listado de Personas Registradas',
        currentUser: req.user,
        personas,
        sectoresUnicos,
        filters: { search, sector, sexo, activo, verificado },
        alertMessage: msg || null,
        alertType: type,
        path: '/personas'
      });
    } catch (error) {
      console.error('[PersonaController index error]:', error);
      return res.render('personas/index', {
        title: 'Listado de Personas Registradas',
        currentUser: req.user,
        personas: [],
        sectoresUnicos: [],
        filters: {},
        alertMessage: 'Ocurrió un error al cargar el listado de personas.',
        alertType: 'error',
        path: '/personas'
      });
    }
  }

  /**
   * Vista de registro de nueva persona (Admin)
   */
  static async showCreate(req, res) {
    const colegios = await ColegioModel.findAll({ activo: 'true' });
    return res.render('personas/create', {
      title: 'Registrar Nueva Persona',
      currentUser: req.user,
      colegios,
      errors: [],
      oldInput: {},
      path: '/personas'
    });
  }

  /**
   * Procesa el formulario de registro de personas por parte del Administrador
   */
  static async create(req, res) {
    const { nombre, apellido, sexo, cedula, telefono, sector, direccion, email, colegio_electoral } = req.body;

    if (req.validationErrors && req.validationErrors.length > 0) {
      const colegios = await ColegioModel.findAll({ activo: 'true' });
      return res.status(422).render('personas/create', {
        title: 'Registrar Nueva Persona',
        currentUser: req.user,
        colegios,
        alertMessage: 'Por favor revise los campos con errores.',
        alertType: 'error',
        errors: req.validationErrors,
        oldInput: req.body,
        path: '/personas'
      });
    }

    try {
      await PersonaModel.create({
        nombre,
        apellido,
        sexo,
        cedula,
        telefono,
        sector,
        direccion,
        email,
        colegio_electoral,
        origen_registro: 'admin',
        ip_origen: req.ip || req.connection.remoteAddress
      });

      return res.redirect('/personas?msg=' + encodeURIComponent('Persona registrada exitosamente con datos cifrados.') + '&type=success');
    } catch (error) {
      console.error('[PersonaController create error]:', error);
      const isDuplicate = error.status === 409 || error.message.includes('No. de Cédula');
      const colegios = await ColegioModel.findAll({ activo: 'true' });
      return res.status(isDuplicate ? 409 : 500).render('personas/create', {
        title: 'Registrar Nueva Persona',
        currentUser: req.user,
        colegios,
        alertMessage: error.message || 'Error al procesar el registro de la persona.',
        alertType: 'error',
        errors: [],
        oldInput: req.body,
        path: '/personas'
      });
    }
  }

  /**
   * Vista de detalle de la persona con sus datos descifrados para el Administrador
   */
  static async show(req, res) {
    try {
      const { id } = req.params;
      const persona = await PersonaModel.findById(id);

      if (!persona) {
        return res.redirect('/personas?msg=' + encodeURIComponent('La persona solicitada no existe.') + '&type=error');
      }

      return res.render('personas/show', {
        title: `Detalle: ${persona.nombre} ${persona.apellido}`,
        currentUser: req.user,
        persona,
        path: '/personas'
      });
    } catch (error) {
      console.error('[PersonaController show error]:', error);
      return res.redirect('/personas?msg=' + encodeURIComponent('Error al obtener el detalle de la persona.') + '&type=error');
    }
  }

  /**
   * Vista de edición de datos de la persona
   */
  static async showEdit(req, res) {
    try {
      const { id } = req.params;
      const persona = await PersonaModel.findById(id);

      if (!persona) {
        return res.redirect('/personas?msg=' + encodeURIComponent('Persona no encontrada.') + '&type=error');
      }

      const colegios = await ColegioModel.findAll({ activo: 'true' });
      return res.render('personas/edit', {
        title: `Editar Registro: ${persona.nombre} ${persona.apellido}`,
        currentUser: req.user,
        persona,
        colegios,
        errors: [],
        oldInput: persona,
        path: '/personas'
      });
    } catch (error) {
      console.error('[PersonaController showEdit error]:', error);
      return res.redirect('/personas?msg=' + encodeURIComponent('Error al abrir la edición.') + '&type=error');
    }
  }

  /**
   * Procesa la actualización de los datos de la persona
   */
  static async update(req, res) {
    const { id } = req.params;
    const { nombre, apellido, sexo, cedula, telefono, sector, direccion, email, colegio_electoral, verificado_partido } = req.body;

    if (req.validationErrors && req.validationErrors.length > 0) {
      const colegios = await ColegioModel.findAll({ activo: 'true' });
      return res.status(422).render('personas/edit', {
        title: 'Editar Registro',
        currentUser: req.user,
        persona: { id, ...req.body },
        colegios,
        alertMessage: 'Por favor corrija los campos requeridos.',
        alertType: 'error',
        errors: req.validationErrors,
        oldInput: req.body,
        path: '/personas'
      });
    }

    try {
      await PersonaModel.update(id, {
        nombre,
        apellido,
        sexo,
        cedula,
        telefono,
        sector,
        direccion,
        email,
        colegio_electoral,
        verificado_partido
      });

      return res.redirect('/personas/' + id + '?msg=' + encodeURIComponent('Datos actualizados correctamente.') + '&type=success');
    } catch (error) {
      console.error('[PersonaController update error]:', error);
      return res.status(500).render('personas/edit', {
        title: 'Editar Registro',
        currentUser: req.user,
        persona: { id, ...req.body },
        alertMessage: error.message || 'Error al actualizar los datos de la persona.',
        alertType: 'error',
        errors: [],
        oldInput: req.body,
        path: '/personas'
      });
    }
  }

  /**
   * Alterna el estado Activo / Inactivo de la persona
   */
  static async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const persona = await PersonaModel.toggleActivo(id);

      if (!persona) {
        return res.redirect('/personas?msg=' + encodeURIComponent('No se encontró a la persona.') + '&type=error');
      }

      const statusText = persona.activo ? 'activada' : 'inactivada';
      return res.redirect('/personas?msg=' + encodeURIComponent(`La persona fue ${statusText} exitosamente.`) + '&type=success');
    } catch (error) {
      console.error('[PersonaController toggleStatus error]:', error);
      return res.redirect('/personas?msg=' + encodeURIComponent('Error al cambiar el estado.') + '&type=error');
    }
  }
}

module.exports = PersonaController;
