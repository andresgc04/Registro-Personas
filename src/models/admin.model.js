const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isConfigured } = require('../config/supabase');
const config = require('../config/env');

const LOCAL_DATA_DIR = path.resolve(__dirname, '../../data');
const LOCAL_ADMINS_FILE = path.join(LOCAL_DATA_DIR, 'admins.json');

// Definición oficial de Módulos del Sistema
const SYSTEM_MODULES = [
  { id: 'dashboard', nombre: 'Dashboard KPIs', descripcion: 'Visualización de métricas y estadísticas' },
  { id: 'personas', nombre: 'Listado y Registro de Personas', descripcion: 'Gestión completa de personas empadronadas' },
  { id: 'colegios', nombre: 'Colegios Electorales', descripcion: 'Consulta y registro de recintos electorales' },
  { id: 'newsletter', nombre: 'Boletines Informativos', descripcion: 'Despacho de comunicados por Email y WhatsApp' },
  { id: 'usuarios', nombre: 'Gestión de Usuarios y Roles', descripcion: 'Administración de accesos, roles y usuarios' }
];

// Definición oficial de Roles del Sistema
const ROLES = {
  superadmin: {
    id: 'superadmin',
    nombre: 'Superadministrador',
    descripcion: 'Acceso total y configuración de usuarios y roles',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    defaultPermissions: ['dashboard', 'personas', 'colegios', 'newsletter', 'usuarios']
  },
  admin: {
    id: 'admin',
    nombre: 'Administrador',
    descripcion: 'Gestión operativa, personas, colegios y comunicados',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    defaultPermissions: ['dashboard', 'personas', 'colegios', 'newsletter']
  },
  operador: {
    id: 'operador',
    nombre: 'Operador / Digitador',
    descripcion: 'Registro y actualización de personas y recintos',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    defaultPermissions: ['personas', 'colegios']
  },
  consultor: {
    id: 'consultor',
    nombre: 'Consultor / Solo Lectura',
    descripcion: 'Visualización de estadísticas y padrón sin edición',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    defaultPermissions: ['dashboard', 'personas']
  }
};

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function getLocalAdmins() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_ADMINS_FILE)) {
    fs.writeFileSync(LOCAL_ADMINS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_ADMINS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalAdmins(admins) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_ADMINS_FILE, JSON.stringify(admins, null, 2));
}

class AdminModel {
  static get SYSTEM_MODULES() {
    return SYSTEM_MODULES;
  }

  static get ROLES() {
    return ROLES;
  }

  /**
   * Obtiene los permisos por defecto para un rol
   */
  static getDefaultPermissionsForRole(role) {
    if (ROLES[role]) {
      return [...ROLES[role].defaultPermissions];
    }
    return ['personas'];
  }

  /**
   * Comprueba si un usuario tiene permiso para acceder a un módulo específico
   */
  static hasPermission(user, moduleName) {
    if (!user || !user.activo) return false;
    // Superadmin tiene acceso a todo de manera incondicional
    if (user.role === 'superadmin') return true;

    // Si el usuario tiene un array de permisos explícitos
    if (Array.isArray(user.permisos) && user.permisos.length > 0) {
      return user.permisos.includes(moduleName);
    }

    // Permisos por defecto según su rol
    const defaults = AdminModel.getDefaultPermissionsForRole(user.role);
    return defaults.includes(moduleName);
  }

  /**
   * Inicializa el administrador predeterminado si no existe ninguno
   */
  static async seedInitialAdmin() {
    try {
      const email = config.INITIAL_ADMIN_EMAIL.toLowerCase();
      const existing = await AdminModel.findByEmail(email);

      if (!existing) {
        const hashedPassword = await bcrypt.hash(config.INITIAL_ADMIN_PASSWORD, 12);
        await AdminModel.create({
          nombre: 'Administrador Principal',
          email,
          password_hash: hashedPassword,
          role: 'superadmin',
          permisos: ['dashboard', 'personas', 'colegios', 'newsletter', 'usuarios'],
          activo: true
        });
        console.log(`[Admin Seed] Administrador inicial creado con éxito: ${email}`);
      }
    } catch (err) {
      console.warn('[Admin Seed] Aviso al verificar/crear admin inicial:', err.message);
    }
  }

  /**
   * Obtiene todos los usuarios administradores con filtros
   */
  static async findAll({ search = '', role = '', activo = '' } = {}) {
    let records = [];

    if (isConfigured && supabase) {
      try {
        let query = supabase.from('admins').select('*').order('created_at', { ascending: false });
        if (role) query = query.eq('role', role);
        if (activo !== '') query = query.eq('activo', activo === 'true');

        const { data, error } = await query;
        if (error) throw error;
        records = data || [];
      } catch (err) {
        console.warn('[AdminModel Supabase] Error findAll, probando fallback local:', err.message);
        records = getLocalAdmins();
      }
    } else {
      records = getLocalAdmins();
      if (role) {
        records = records.filter(a => a.role === role);
      }
      if (activo !== '') {
        const isActivo = activo === 'true';
        records = records.filter(a => a.activo === isActivo);
      }
    }

    // Filtrar por término de búsqueda en nombre o correo
    if (search && search.trim() !== '') {
      const term = search.trim().toLowerCase();
      records = records.filter(a =>
        a.nombre.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term)
      );
    }

    // Sanitizar registros eliminando password_hash y normalizando permisos
    return records.map(a => {
      const { password_hash, ...rest } = a;
      return {
        ...rest,
        permisos: Array.isArray(a.permisos) && a.permisos.length > 0
          ? a.permisos
          : AdminModel.getDefaultPermissionsForRole(a.role)
      };
    });
  }

  /**
   * Busca un administrador por correo electrónico
   */
  static async findByEmail(email) {
    const normalizedEmail = String(email).trim().toLowerCase();

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admins')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          data.permisos = Array.isArray(data.permisos) && data.permisos.length > 0
            ? data.permisos
            : AdminModel.getDefaultPermissionsForRole(data.role);
        }
        return data;
      } catch (err) {
        console.warn('[AdminModel Supabase] Error al buscar por email, probando fallback local:', err.message);
      }
    }

    const admins = getLocalAdmins();
    const found = admins.find(a => a.email.toLowerCase() === normalizedEmail);
    if (!found) return null;

    return {
      ...found,
      permisos: Array.isArray(found.permisos) && found.permisos.length > 0
        ? found.permisos
        : AdminModel.getDefaultPermissionsForRole(found.role)
    };
  }

  /**
   * Busca un administrador por ID
   */
  static async findById(id) {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admins')
          .select('id, nombre, email, role, permisos, activo, created_at, updated_at')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          data.permisos = Array.isArray(data.permisos) && data.permisos.length > 0
            ? data.permisos
            : AdminModel.getDefaultPermissionsForRole(data.role);
        }
        return data;
      } catch (err) {
        console.warn('[AdminModel Supabase] Fallback findById:', err.message);
      }
    }

    const admins = getLocalAdmins();
    const admin = admins.find(a => a.id === id);
    if (!admin) return null;
    const { password_hash, ...rest } = admin;
    return {
      ...rest,
      permisos: Array.isArray(admin.permisos) && admin.permisos.length > 0
        ? admin.permisos
        : AdminModel.getDefaultPermissionsForRole(admin.role)
    };
  }

  /**
   * Crea un nuevo administrador
   */
  static async create({ nombre, email, password_hash, role = 'admin', permisos, activo = true }) {
    const assignedPerms = Array.isArray(permisos) && permisos.length > 0
      ? permisos
      : AdminModel.getDefaultPermissionsForRole(role);

    const newAdmin = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      nombre: String(nombre).trim(),
      email: String(email).trim().toLowerCase(),
      password_hash,
      role: ROLES[role] ? role : 'admin',
      permisos: assignedPerms,
      activo: Boolean(activo),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admins')
          .insert([newAdmin])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[AdminModel Supabase] Error al crear en Supabase, guardando en local:', err.message);
      }
    }

    const admins = getLocalAdmins();
    admins.push(newAdmin);
    saveLocalAdmins(admins);
    return newAdmin;
  }

  /**
   * Actualiza los datos de un administrador
   */
  static async update(id, updates) {
    const existing = await AdminModel.findById(id);
    if (!existing) {
      const err = new Error('Usuario no encontrado.');
      err.status = 404;
      throw err;
    }

    const updatedData = {
      nombre: updates.nombre ? String(updates.nombre).trim() : existing.nombre,
      role: updates.role && ROLES[updates.role] ? updates.role : existing.role,
      updated_at: new Date().toISOString()
    };

    // Actualizar correo electrónico si cambió
    if (updates.email && updates.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      const cleanEmail = updates.email.trim().toLowerCase();
      const duplicate = await AdminModel.findByEmail(cleanEmail);
      if (duplicate && duplicate.id !== id) {
        const err = new Error('Ya existe otro usuario registrado con este correo electrónico.');
        err.status = 409;
        throw err;
      }
      updatedData.email = cleanEmail;
    }

    // Actualizar contraseña si se envió una nueva
    if (updates.password_hash) {
      updatedData.password_hash = updates.password_hash;
    }

    // Actualizar permisos
    if (updates.permisos !== undefined) {
      updatedData.permisos = Array.isArray(updates.permisos)
        ? updates.permisos
        : AdminModel.getDefaultPermissionsForRole(updatedData.role || existing.role);
    }

    // Actualizar estado activo
    if (updates.activo !== undefined) {
      updatedData.activo = updates.activo === true || updates.activo === 'true';
    }

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admins')
          .update(updatedData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[AdminModel Supabase] Error al actualizar, guardando en local:', err.message);
      }
    }

    const admins = getLocalAdmins();
    const idx = admins.findIndex(a => a.id === id);
    if (idx !== -1) {
      admins[idx] = { ...admins[idx], ...updatedData };
      saveLocalAdmins(admins);
      return admins[idx];
    }
    return null;
  }

  /**
   * Alterna el estado activo/inactivo de un usuario
   */
  static async toggleStatus(id, currentUserId) {
    if (id === currentUserId) {
      const err = new Error('No puede desactivar su propia cuenta de usuario en sesión.');
      err.status = 400;
      throw err;
    }

    const admin = await AdminModel.findById(id);
    if (!admin) {
      const err = new Error('Usuario no encontrado.');
      err.status = 404;
      throw err;
    }

    // Protección para el superadmin inicial
    if (admin.email.toLowerCase() === config.INITIAL_ADMIN_EMAIL.toLowerCase()) {
      const err = new Error('No se puede desactivar la cuenta del Superadministrador Principal del sistema.');
      err.status = 403;
      throw err;
    }

    const nuevoEstado = !admin.activo;
    return AdminModel.update(id, { activo: nuevoEstado });
  }

  /**
   * Elimina un usuario del sistema con protecciones de seguridad
   */
  static async delete(id, currentUserId) {
    if (id === currentUserId) {
      const err = new Error('No puede eliminar su propia cuenta de usuario en sesión.');
      err.status = 400;
      throw err;
    }

    const admin = await AdminModel.findById(id);
    if (!admin) {
      const err = new Error('Usuario no encontrado.');
      err.status = 404;
      throw err;
    }

    // Protección para el superadmin inicial
    if (admin.email.toLowerCase() === config.INITIAL_ADMIN_EMAIL.toLowerCase()) {
      const err = new Error('No se puede eliminar la cuenta del Superadministrador Principal del sistema.');
      err.status = 403;
      throw err;
    }

    if (isConfigured && supabase) {
      try {
        const { error } = await supabase.from('admins').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('[AdminModel Supabase] Error delete:', err.message);
      }
    }

    const admins = getLocalAdmins();
    const filtered = admins.filter(a => a.id !== id);
    saveLocalAdmins(filtered);
    return true;
  }

  /**
   * KPIs del módulo de usuarios
   */
  static async getKPIs() {
    const list = await AdminModel.findAll();
    const total = list.length;
    const activos = list.filter(u => u.activo).length;
    const inactivos = total - activos;
    const porRol = {
      superadmin: list.filter(u => u.role === 'superadmin').length,
      admin: list.filter(u => u.role === 'admin').length,
      operador: list.filter(u => u.role === 'operador').length,
      consultor: list.filter(u => u.role === 'consultor').length
    };

    return { total, activos, inactivos, porRol };
  }

  /**
   * Compara una contraseña en texto plano contra el hash de bcrypt
   */
  static async comparePassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}

module.exports = AdminModel;
