const bcrypt = require('bcryptjs');
const AdminModel = require('../models/admin.model');

class UsuarioController {
  /**
   * Listado principal de usuarios con KPIs y filtros
   */
  static async index(req, res) {
    try {
      const { search = '', role = '', activo = '', msg = '', type = 'info' } = req.query;

      const usuarios = await AdminModel.findAll({ search, role, activo });
      const kpis = await AdminModel.getKPIs();

      return res.render('usuarios/index', {
        title: 'Gestión de Usuarios y Roles',
        currentUser: req.user,
        usuarios,
        kpis,
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        filters: { search, role, activo },
        alertMessage: msg || null,
        alertType: type,
        path: '/usuarios'
      });
    } catch (error) {
      console.error('[UsuarioController index error]:', error);
      return res.render('usuarios/index', {
        title: 'Gestión de Usuarios y Roles',
        currentUser: req.user,
        usuarios: [],
        kpis: { total: 0, activos: 0, inactivos: 0, porRol: {} },
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        filters: {},
        alertMessage: 'Error al cargar el listado de usuarios.',
        alertType: 'error',
        path: '/usuarios'
      });
    }
  }

  /**
   * Formulario para registrar un nuevo usuario
   */
  static showCreate(req, res) {
    return res.render('usuarios/create', {
      title: 'Registrar Nuevo Usuario',
      currentUser: req.user,
      roles: AdminModel.ROLES,
      modules: AdminModel.SYSTEM_MODULES,
      errors: [],
      oldInput: { role: 'admin', activo: 'true' },
      path: '/usuarios'
    });
  }

  /**
   * Procesa el registro de un nuevo usuario
   */
  static async create(req, res) {
    const { nombre, email, password, role, permisos, activo } = req.body;

    if (req.validationErrors && req.validationErrors.length > 0) {
      return res.status(422).render('usuarios/create', {
        title: 'Registrar Nuevo Usuario',
        currentUser: req.user,
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        alertMessage: 'Por favor complete todos los campos requeridos correctamente.',
        alertType: 'error',
        errors: req.validationErrors,
        oldInput: req.body,
        path: '/usuarios'
      });
    }

    try {
      // Verificar si el correo ya existe
      const existing = await AdminModel.findByEmail(email);
      if (existing) {
        return res.status(409).render('usuarios/create', {
          title: 'Registrar Nuevo Usuario',
          currentUser: req.user,
          roles: AdminModel.ROLES,
          modules: AdminModel.SYSTEM_MODULES,
          alertMessage: 'Ya existe un usuario registrado con este correo electrónico.',
          alertType: 'error',
          errors: [{ path: 'email', msg: 'El correo electrónico ya está registrado.' }],
          oldInput: req.body,
          path: '/usuarios'
        });
      }

      // Hashear la contraseña con bcrypt (12 rondas OWASP)
      const password_hash = await bcrypt.hash(password, 12);

      // Normalizar permisos (si viene como array o elemento individual de checkbox)
      let finalPermisos = [];
      if (Array.isArray(permisos)) {
        finalPermisos = permisos;
      } else if (typeof permisos === 'string') {
        finalPermisos = [permisos];
      } else {
        finalPermisos = AdminModel.getDefaultPermissionsForRole(role);
      }

      await AdminModel.create({
        nombre,
        email,
        password_hash,
        role,
        permisos: finalPermisos,
        activo: activo === 'true' || activo === true
      });

      return res.redirect('/usuarios?msg=' + encodeURIComponent(`Usuario ${nombre} registrado exitosamente.`) + '&type=success');
    } catch (error) {
      console.error('[UsuarioController create error]:', error);
      return res.status(500).render('usuarios/create', {
        title: 'Registrar Nuevo Usuario',
        currentUser: req.user,
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        alertMessage: 'Ocurrió un error inesperado al crear el usuario: ' + error.message,
        alertType: 'error',
        errors: [],
        oldInput: req.body,
        path: '/usuarios'
      });
    }
  }

  /**
   * Formulario para editar un usuario existente
   */
  static async showEdit(req, res) {
    const { id } = req.params;

    try {
      const usuario = await AdminModel.findById(id);
      if (!usuario) {
        return res.redirect('/usuarios?msg=' + encodeURIComponent('El usuario solicitado no existe.') + '&type=error');
      }

      return res.render('usuarios/edit', {
        title: 'Editar Usuario y Permisos',
        currentUser: req.user,
        usuario,
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        errors: [],
        oldInput: usuario,
        path: '/usuarios'
      });
    } catch (error) {
      console.error('[UsuarioController showEdit error]:', error);
      return res.redirect('/usuarios?msg=' + encodeURIComponent('Error al abrir la edición de usuario.') + '&type=error');
    }
  }

  /**
   * Procesa la actualización de un usuario
   */
  static async update(req, res) {
    const { id } = req.params;
    const { nombre, email, password, role, permisos, activo } = req.body;

    if (req.validationErrors && req.validationErrors.length > 0) {
      return res.status(422).render('usuarios/edit', {
        title: 'Editar Usuario y Permisos',
        currentUser: req.user,
        usuario: { id, ...req.body },
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        alertMessage: 'Por favor revise los campos con observaciones.',
        alertType: 'error',
        errors: req.validationErrors,
        oldInput: req.body,
        path: '/usuarios'
      });
    }

    try {
      const updates = {
        nombre,
        email,
        role,
        activo: activo === 'true' || activo === true
      };

      // Si se especificó una nueva contraseña
      if (password && password.trim() !== '') {
        updates.password_hash = await bcrypt.hash(password.trim(), 12);
      }

      // Procesar permisos
      if (Array.isArray(permisos)) {
        updates.permisos = permisos;
      } else if (typeof permisos === 'string') {
        updates.permisos = [permisos];
      } else if (role) {
        updates.permisos = AdminModel.getDefaultPermissionsForRole(role);
      }

      await AdminModel.update(id, updates);

      return res.redirect('/usuarios?msg=' + encodeURIComponent('Usuario actualizado correctamente.') + '&type=success');
    } catch (error) {
      console.error('[UsuarioController update error]:', error);
      const isConflict = error.status === 409;
      return res.status(isConflict ? 409 : 500).render('usuarios/edit', {
        title: 'Editar Usuario y Permisos',
        currentUser: req.user,
        usuario: { id, ...req.body },
        roles: AdminModel.ROLES,
        modules: AdminModel.SYSTEM_MODULES,
        alertMessage: error.message || 'Error al actualizar el usuario.',
        alertType: 'error',
        errors: isConflict ? [{ path: 'email', msg: error.message }] : [],
        oldInput: req.body,
        path: '/usuarios'
      });
    }
  }

  /**
   * Alterna el estado activo/inactivo de un usuario
   */
  static async toggleStatus(req, res) {
    const { id } = req.params;

    try {
      await AdminModel.toggleStatus(id, req.user ? req.user.id : null);
      return res.redirect('/usuarios?msg=' + encodeURIComponent('Estado del usuario actualizado.') + '&type=success');
    } catch (error) {
      return res.redirect('/usuarios?msg=' + encodeURIComponent(error.message) + '&type=error');
    }
  }

  /**
   * Elimina un usuario
   */
  static async delete(req, res) {
    const { id } = req.params;

    try {
      await AdminModel.delete(id, req.user ? req.user.id : null);
      return res.redirect('/usuarios?msg=' + encodeURIComponent('Usuario eliminado del sistema correctamente.') + '&type=success');
    } catch (error) {
      return res.redirect('/usuarios?msg=' + encodeURIComponent(error.message) + '&type=error');
    }
  }
}

module.exports = UsuarioController;

