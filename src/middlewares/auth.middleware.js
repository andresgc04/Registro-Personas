const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AdminModel = require('../models/admin.model');

/**
 * Middleware para proteger rutas de administración con JWT y validar sesión activa
 */
async function requireAuth(req, res, next) {
  let token = req.cookies ? req.cookies.auth_token : null;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ error: 'No autenticado. Inicie sesión.' });
    }
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Consultar estado actual del usuario en la base de datos o almacenamiento local
    const currentUser = await AdminModel.findById(decoded.id);

    if (!currentUser) {
      res.clearCookie('auth_token');
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({ error: 'Usuario no encontrado o eliminado.' });
      }
      return res.redirect('/auth/login?error=expired');
    }

    if (!currentUser.activo) {
      res.clearCookie('auth_token');
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(403).json({ error: 'Cuenta de usuario desactivada.' });
      }
      return res.redirect('/auth/login?error=inactive');
    }

    // Normalizar permisos del usuario
    currentUser.permisos = currentUser.permisos || AdminModel.getDefaultPermissionsForRole(currentUser.role);

    req.user = currentUser;
    res.locals.currentUser = currentUser;
    res.locals.ROLES = AdminModel.ROLES;
    res.locals.SYSTEM_MODULES = AdminModel.SYSTEM_MODULES;
    res.locals.hasPermission = (modulo) => AdminModel.hasPermission(currentUser, modulo);

    return next();
  } catch (error) {
    res.clearCookie('auth_token');
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
    return res.redirect('/auth/login?error=expired');
  }
}

/**
 * Middleware de Control de Acceso Basado en Roles y Permisos (RBAC)
 * Verifica si el usuario actual tiene acceso al módulo indicado
 */
function requirePermission(modulo) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const autorizado = AdminModel.hasPermission(req.user, modulo);
    if (autorizado) {
      return next();
    }

    // En caso de no tener autorización
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado: no cuenta con permisos para el módulo de ${modulo}.`
      });
    }

    const moduloInfo = AdminModel.SYSTEM_MODULES.find(m => m.id === modulo) || { nombre: modulo };
    return res.status(403).render('errors/403', {
      title: 'Acceso Denegado (403)',
      currentUser: req.user,
      modulo: moduloInfo.nombre,
      role: req.user.role,
      path: req.originalUrl
    });
  };
}

/**
 * Middleware para exigir roles específicos (ej: ['superadmin'])
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (roles.includes(req.user.role)) {
      return next();
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: rol insuficiente.'
      });
    }

    return res.status(403).render('errors/403', {
      title: 'Acceso Denegado (403)',
      currentUser: req.user,
      modulo: 'Gestión Administrativa',
      role: req.user.role,
      path: req.originalUrl
    });
  };
}

/**
 * Middleware para rutas públicas de autenticación (si ya está logueado, redirige a dashboard o módulo permitido)
 */
async function redirectIfAuthenticated(req, res, next) {
  const token = req.cookies ? req.cookies.auth_token : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await AdminModel.findById(decoded.id);
      if (user && user.activo) {
        req.user = user;
        // Redirigir según permisos
        if (AdminModel.hasPermission(user, 'dashboard')) {
          return res.redirect('/dashboard');
        } else if (AdminModel.hasPermission(user, 'personas')) {
          return res.redirect('/personas');
        } else if (AdminModel.hasPermission(user, 'colegios')) {
          return res.redirect('/colegios');
        } else if (AdminModel.hasPermission(user, 'newsletter')) {
          return res.redirect('/newsletter');
        } else if (AdminModel.hasPermission(user, 'usuarios')) {
          return res.redirect('/usuarios');
        }
        return res.redirect('/dashboard');
      }
    } catch {
      res.clearCookie('auth_token');
    }
  }
  return next();
}

module.exports = {
  requireAuth,
  requirePermission,
  requireRole,
  redirectIfAuthenticated
};
