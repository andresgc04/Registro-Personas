const jwt = require('jsonwebtoken');
const AdminModel = require('../models/admin.model');
const config = require('../config/env');

class AuthController {
  /**
   * Muestra la pantalla de inicio de sesión
   */
  static showLogin(req, res) {
    const error = req.query.error;
    const logout = req.query.logout;
    const redirect = req.query.redirect || '/dashboard';

    let alertMessage = null;
    let alertType = 'error';

    if (error === 'expired') {
      alertMessage = 'Su sesión ha expirado por inactividad. Por favor ingrese de nuevo.';
      alertType = 'warning';
    } else if (logout) {
      alertMessage = 'Ha cerrado sesión correctamente.';
      alertType = 'success';
    }

    return res.render('auth/login', {
      title: 'Iniciar Sesión - Portal Administrativo',
      alertMessage,
      alertType,
      redirect,
      errors: [],
      oldInput: {}
    });
  }

  /**
   * Procesa la autenticación del administrador emitiendo un JWT seguro en cookie HttpOnly
   */
  static async login(req, res) {
    const { email, password, redirect } = req.body;
    const redirectUrl = redirect || '/dashboard';

    // Si hubo errores en express-validator
    if (req.validationErrors && req.validationErrors.length > 0) {
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Portal Administrativo',
        alertMessage: 'Por favor corrija los errores en el formulario.',
        alertType: 'error',
        redirect: redirectUrl,
        errors: req.validationErrors,
        oldInput: { email }
      });
    }

    try {
      const admin = await AdminModel.findByEmail(email);

      // Verificación de credenciales segura contra ataques de timing
      if (!admin) {
        return res.status(401).render('auth/login', {
          title: 'Iniciar Sesión - Portal Administrativo',
          alertMessage: 'Credenciales inválidas. Verifique su correo o contraseña.',
          alertType: 'error',
          redirect: redirectUrl,
          errors: [],
          oldInput: { email }
        });
      }

      if (!admin.activo) {
        return res.status(403).render('auth/login', {
          title: 'Iniciar Sesión - Portal Administrativo',
          alertMessage: 'Su cuenta de administrador se encuentra inactiva. Contacte al superadministrador.',
          alertType: 'error',
          redirect: redirectUrl,
          errors: [],
          oldInput: { email }
        });
      }

      const isValid = await AdminModel.comparePassword(password, admin.password_hash);
      if (!isValid) {
        return res.status(401).render('auth/login', {
          title: 'Iniciar Sesión - Portal Administrativo',
          alertMessage: 'Credenciales inválidas. Verifique su correo o contraseña.',
          alertType: 'error',
          redirect: redirectUrl,
          errors: [],
          oldInput: { email }
        });
      }

      // Generar JWT con claims mínimos requeridos (Principio de menor privilegio)
      const token = jwt.sign(
        {
          id: admin.id,
          nombre: admin.nombre,
          email: admin.email,
          role: admin.role
        },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      // Almacenar JWT en Cookie HttpOnly (Mitigación OWASP contra XSS)
      const isProduction = config.NODE_ENV === 'production';
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000 // 8 horas
      });

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error('[Login Controller Error]:', err);
      return res.status(500).render('auth/login', {
        title: 'Iniciar Sesión - Portal Administrativo',
        alertMessage: 'Error interno al procesar el inicio de sesión. Intente más tarde.',
        alertType: 'error',
        redirect: redirectUrl,
        errors: [],
        oldInput: { email }
      });
    }
  }

  /**
   * Cierre de sesión seguro
   */
  static logout(req, res) {
    res.clearCookie('auth_token', {
      httpOnly: true,
      sameSite: 'lax'
    });
    return res.redirect('/auth/login?logout=1');
  }
}

module.exports = AuthController;
