const PersonaModel = require('../models/persona.model');
const ColegioModel = require('../models/colegio.model');

class PublicController {
  /**
   * Muestra el formulario público para que las personas se registren sin iniciar sesión
   */
  static async showRegister(req, res) {
    const colegios = await ColegioModel.findAll({ activo: 'true' });
    return res.render('public/register', {
      title: 'Formulario de Registro Ciudadano',
      errors: [],
      oldInput: {},
      colegios,
      alertMessage: null
    });
  }

  /**
   * Procesa el registro enviado desde el enlace público
   */
  static async register(req, res) {
    const { nombre, apellido, sexo, cedula, telefono, sector, direccion, email, colegio_electoral } = req.body;

    if (req.validationErrors && req.validationErrors.length > 0) {
      const colegios = await ColegioModel.findAll({ activo: 'true' });
      return res.status(422).render('public/register', {
        title: 'Formulario de Registro Ciudadano',
        errors: req.validationErrors,
        oldInput: req.body,
        colegios,
        alertMessage: 'Por favor revise los campos señalados a continuación.'
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
        origen_registro: 'publico',
        ip_origen: req.ip || req.connection.remoteAddress
      });

      return res.redirect('/registro/exito');
    } catch (error) {
      console.error('[Public Register Error]:', error);
      const isDuplicate = error.status === 409 || error.message.includes('No. de Cédula');
      const colegios = await ColegioModel.findAll({ activo: 'true' });
      return res.status(isDuplicate ? 409 : 500).render('public/register', {
        title: 'Formulario de Registro Ciudadano',
        errors: [],
        oldInput: req.body,
        colegios,
        alertMessage: isDuplicate
          ? 'Este número de cédula ya se encuentra registrado en el sistema. Si considera que es un error, por favor comuníquese con la administración.'
          : 'Ocurrió un inconveniente al procesar su solicitud. Intente nuevamente en unos minutos.'
      });
    }
  }

  /**
   * Pantalla de confirmación tras completar el registro público exitosamente
   */
  static showSuccess(req, res) {
    return res.render('public/success', {
      title: '¡Registro Exitoso!'
    });
  }
}

module.exports = PublicController;
