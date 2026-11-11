const { body, validationResult } = require('express-validator');

/**
 * Middleware para procesar errores de validación de express-validator
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Si la petición espera JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(422).json({
        success: false,
        errors: errors.array().map(err => ({ field: err.path, msg: err.msg }))
      });
    }

    // Si es petición de formulario web
    req.validationErrors = errors.array();
    req.flashErrors = errors.array().map(e => e.msg);
    return next();
  }
  return next();
}

/**
 * Validaciones para el formulario de login de administrador
 */
const loginValidationRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Debe ingresar un correo electrónico válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.')
];

/**
 * Validaciones para el registro y edición de personas
 * Campos: Nombre, Apellido, Sexo, No. De Cedula, No. de Telefono, Sector, Direccion y Correo Electronico
 */
const personaValidationRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El campo Nombre es obligatorio.')
    .isLength({ min: 2, max: 80 }).withMessage('El Nombre debe tener entre 2 y 80 caracteres.')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('El Nombre solo debe contener letras y espacios.'),

  body('apellido')
    .trim()
    .notEmpty().withMessage('El campo Apellido es obligatorio.')
    .isLength({ min: 2, max: 80 }).withMessage('El Apellido debe tener entre 2 y 80 caracteres.')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('El Apellido solo debe contener letras y espacios.'),

  body('sexo')
    .trim()
    .notEmpty().withMessage('Debe seleccionar el Sexo.')
    .isIn(['M', 'F', 'Otro']).withMessage('El Sexo seleccionado no es válido. Opciones: M, F, Otro.'),

  body('cedula')
    .trim()
    .notEmpty().withMessage('El No. de Cédula es obligatorio.')
    .custom((value) => {
      // Remover guiones o espacios para verificar formato
      const digitsOnly = value.replace(/[\s-]/g, '');
      // Validar si tiene 11 dígitos numéricos (estándar común) o formato numérico válido de 9 a 12 dígitos
      if (!/^\d{9,12}$/.test(digitsOnly)) {
        throw new Error('El formato de No. de Cédula no es válido (Debe contener 11 dígitos, ej: 001-1234567-8).');
      }
      return true;
    }),

  body('telefono')
    .trim()
    .notEmpty().withMessage('El No. de Teléfono es obligatorio.')
    .custom((value) => {
      // Limpiar caracteres comunes: paréntesis, guiones, espacios, +
      const digits = value.replace(/[\s\-\(\)\+]/g, '');
      if (!/^\d{10,15}$/.test(digits)) {
        throw new Error('El formato del No. de Teléfono no es válido (mínimo 10 dígitos, ej: 809-555-0123 o +18095550123).');
      }
      return true;
    }),

  body('sector')
    .trim()
    .notEmpty().withMessage('El Sector es obligatorio.')
    .isLength({ min: 2, max: 120 }).withMessage('El Sector debe tener entre 2 y 120 caracteres.'),

  body('direccion')
    .trim()
    .notEmpty().withMessage('La Dirección es obligatoria.')
    .isLength({ min: 5, max: 250 }).withMessage('La Dirección debe tener entre 5 y 250 caracteres.'),

  body('email')
    .trim()
    .optional({ checkFalsy: true })
    .isEmail().withMessage('El formato del Correo Electrónico no es válido (ej: usuario@dominio.com).')
    .normalizeEmail()
];

/**
 * Validaciones para el envío de boletines
 */
const newsletterValidationRules = [
  body('titulo')
    .trim()
    .notEmpty().withMessage('El título del boletín es obligatorio.')
    .isLength({ min: 5, max: 200 }).withMessage('El título debe tener entre 5 y 200 caracteres.'),
  body('mensaje')
    .trim()
    .notEmpty().withMessage('El mensaje del boletín es obligatorio.')
    .isLength({ min: 10, max: 5000 }).withMessage('El mensaje debe tener al menos 10 caracteres.'),
  body('canal')
    .trim()
    .notEmpty().withMessage('Debe seleccionar un canal de envío.')
    .isIn(['email', 'whatsapp', 'ambos']).withMessage('Canal inválido. Opciones: email, whatsapp, ambos.')
];

/**
 * Validaciones para Colegios Electorales
 * Campos: Codigo, Nombre del Recinto, Municipio, Sector, Direccion, Mesas, Electores
 */
const colegioValidationRules = [
  body('codigo')
    .trim()
    .notEmpty().withMessage('El Código del Colegio Electoral es obligatorio.')
    .isLength({ min: 2, max: 30 }).withMessage('El Código debe tener entre 2 y 30 caracteres.'),
  body('nombre')
    .trim()
    .notEmpty().withMessage('El Nombre del Recinto Electoral es obligatorio.')
    .isLength({ min: 3, max: 150 }).withMessage('El Nombre del Recinto debe tener entre 3 y 150 caracteres.'),
  body('municipio')
    .trim()
    .notEmpty().withMessage('El Municipio o Provincia es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El Municipio debe tener entre 2 y 100 caracteres.'),
  body('sector')
    .trim()
    .notEmpty().withMessage('El Sector es obligatorio.')
    .isLength({ min: 2, max: 120 }).withMessage('El Sector debe tener entre 2 y 120 caracteres.'),
  body('direccion')
    .trim()
    .notEmpty().withMessage('La Dirección es obligatoria.')
    .isLength({ min: 5, max: 250 }).withMessage('La Dirección debe tener entre 5 y 250 caracteres.'),
  body('mesas')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 100 }).withMessage('La cantidad de mesas debe ser un número entero entre 1 y 100.'),
  body('electores')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 }).withMessage('La cantidad estimada de electores debe ser un número positivo.')
];

/**
 * Validaciones para Creación de Usuarios y Administradores
 */
const userCreateValidationRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El Nombre completo es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El Nombre debe tener entre 2 y 100 caracteres.'),
  body('email')
    .trim()
    .notEmpty().withMessage('El Correo Electrónico es obligatorio.')
    .isEmail().withMessage('Ingrese un correo electrónico válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('La confirmación de la contraseña no coincide con la contraseña.');
      }
      return true;
    }),
  body('role')
    .trim()
    .notEmpty().withMessage('Debe seleccionar un Rol de usuario.')
    .isIn(['superadmin', 'admin', 'operador', 'consultor']).withMessage('El Rol seleccionado no es válido.')
];

/**
 * Validaciones para Edición de Usuarios
 */
const userEditValidationRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El Nombre completo es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El Nombre debe tener entre 2 y 100 caracteres.'),
  body('email')
    .trim()
    .notEmpty().withMessage('El Correo Electrónico es obligatorio.')
    .isEmail().withMessage('Ingrese un correo electrónico válido.')
    .normalizeEmail(),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 6 }).withMessage('Si desea cambiar la contraseña, debe tener al menos 6 caracteres.'),
  body('confirm_password')
    .custom((value, { req }) => {
      if (req.body.password && req.body.password.trim() !== '') {
        if (value !== req.body.password) {
          throw new Error('La confirmación no coincide con la nueva contraseña.');
        }
      }
      return true;
    }),
  body('role')
    .trim()
    .notEmpty().withMessage('Debe seleccionar un Rol de usuario.')
    .isIn(['superadmin', 'admin', 'operador', 'consultor']).withMessage('El Rol seleccionado no es válido.')
];

module.exports = {
  handleValidationErrors,
  loginValidationRules,
  personaValidationRules,
  newsletterValidationRules,
  colegioValidationRules,
  userCreateValidationRules,
  userEditValidationRules
};
