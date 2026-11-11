const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isConfigured } = require('../config/supabase');
const cryptoService = require('../services/crypto.service');

const LOCAL_DATA_DIR = path.resolve(__dirname, '../../data');
const LOCAL_PERSONAS_FILE = path.join(LOCAL_DATA_DIR, 'personas.json');

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function getLocalPersonas() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_PERSONAS_FILE)) {
    fs.writeFileSync(LOCAL_PERSONAS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_PERSONAS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalPersonas(personas) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_PERSONAS_FILE, JSON.stringify(personas, null, 2));
}

class PersonaModel {
  /**
   * Crea una nueva persona registrando los datos sensibles cifrados con AES-256-GCM
   * y calculando el Blind Index Hash (HMAC-SHA256) para unicidad y búsqueda.
   */
  static async create({
    nombre,
    apellido,
    sexo,
    cedula,
    telefono,
    sector,
    direccion,
    email,
    colegio_electoral = '',
    verificado_partido = false,
    origen_registro = 'admin',
    ip_origen = ''
  }) {
    // Normalizaciones previas
    const cleanCedula = String(cedula).trim();
    const cleanTelefono = String(telefono).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';

    // 1. Blind Index Hashes (HMAC-SHA256) para validación de unicidad
    const cedula_hash = cryptoService.hashBlindIndex(cleanCedula);
    const email_hash = cleanEmail ? cryptoService.hashBlindIndex(cleanEmail) : null;

    // Verificar si ya existe registrada esa cédula
    const existing = await PersonaModel.findByCedulaHash(cedula_hash);
    if (existing) {
      const err = new Error('Ya existe una persona registrada con este No. de Cédula.');
      err.status = 409;
      throw err;
    }

    // 2. Cifrado autenticado AES-256-GCM (OWASP Cryptographic Standards)
    const cedula_enc = cryptoService.encrypt(cleanCedula);
    const telefono_enc = cryptoService.encrypt(cleanTelefono);
    const email_enc = cleanEmail ? cryptoService.encrypt(cleanEmail) : null;

    const newPersonaRecord = {
      id: crypto.randomUUID() ? crypto.randomUUID() : 'per_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      sexo,
      cedula_enc,
      telefono_enc,
      email_enc,
      cedula_hash,
      email_hash,
      sector: String(sector).trim(),
      direccion: String(direccion).trim(),
      colegio_electoral: colegio_electoral ? String(colegio_electoral).trim() : '',
      activo: true,
      verificado_partido: verificado_partido === true || verificado_partido === 'true',
      origen_registro,
      ip_origen,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .insert([newPersonaRecord])
          .select()
          .single();

        if (error) throw error;
        return PersonaModel._decryptPersona(data);
      } catch (err) {
        console.warn('[PersonaModel Supabase] Error al insertar en Supabase, guardando en fallback local:', err.message);
      }
    }

    // Persistencia local
    const personas = getLocalPersonas();
    personas.unshift(newPersonaRecord);
    saveLocalPersonas(personas);

    return PersonaModel._decryptPersona(newPersonaRecord);
  }

  /**
   * Obtiene listado de personas con filtros y datos descifrados para el Administrador
   */
  static async findAll({ search = '', sector = '', sexo = '', activo = '', verificado = '' } = {}) {
    let records = [];

    if (isConfigured && supabase) {
      try {
        let query = supabase.from('personas').select('*').order('created_at', { ascending: false });
        if (sector) query = query.eq('sector', sector);
        if (sexo) query = query.eq('sexo', sexo);
        if (activo !== '') query = query.eq('activo', activo === 'true');
        if (verificado !== '') query = query.eq('verificado_partido', verificado === 'true');

        const { data, error } = await query;
        if (error) throw error;
        records = data || [];
      } catch (err) {
        console.warn('[PersonaModel Supabase] Fallback findAll:', err.message);
        records = getLocalPersonas();
      }
    } else {
      records = getLocalPersonas();
      // Aplicar filtros locales
      if (sector) {
        records = records.filter(p => p.sector.toLowerCase() === sector.toLowerCase());
      }
      if (sexo) {
        records = records.filter(p => p.sexo === sexo);
      }
      if (activo !== '') {
        const isActivo = activo === 'true';
        records = records.filter(p => p.activo === isActivo);
      }
      if (verificado !== '') {
        const isVerif = verificado === 'true';
        records = records.filter(p => (p.verificado_partido === true || p.verificado_partido === 'true') === isVerif);
      }
    }

    // Descifrado seguro de datos sensibles en memoria únicamente para el Administrador
    const decryptedList = records.map(p => PersonaModel._decryptPersona(p));

    // Búsqueda en memoria por texto en nombre, apellido, cédula, sector o email
    if (search && search.trim() !== '') {
      const term = search.trim().toLowerCase();
      return decryptedList.filter(p =>
        p.nombre.toLowerCase().includes(term) ||
        p.apellido.toLowerCase().includes(term) ||
        p.cedula.toLowerCase().includes(term) ||
        p.sector.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.telefono.toLowerCase().includes(term)
      );
    }

    return decryptedList;
  }

  /**
   * Obtiene una persona por ID con sus datos descifrados
   */
  static async findById(id) {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;
        return PersonaModel._decryptPersona(data);
      } catch (err) {
        console.warn('[PersonaModel Supabase] Fallback findById:', err.message);
      }
    }

    const personas = getLocalPersonas();
    const found = personas.find(p => p.id === id);
    if (!found) return null;
    return PersonaModel._decryptPersona(found);
  }

  /**
   * Busca por Blind Index Hash de Cédula (útil para detectar duplicados)
   */
  static async findByCedulaHash(cedula_hash) {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('id, cedula_hash')
          .eq('cedula_hash', cedula_hash)
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[PersonaModel Supabase] Fallback findByCedulaHash:', err.message);
      }
    }

    const personas = getLocalPersonas();
    return personas.find(p => p.cedula_hash === cedula_hash) || null;
  }

  /**
   * Actualiza los datos de una persona
   */
  static async update(id, updates) {
    const existing = await PersonaModel.findById(id);
    if (!existing) {
      const err = new Error('Persona no encontrada.');
      err.status = 404;
      throw err;
    }

    const updatedData = {
      nombre: updates.nombre ? String(updates.nombre).trim() : existing.nombre,
      apellido: updates.apellido ? String(updates.apellido).trim() : existing.apellido,
      sexo: updates.sexo || existing.sexo,
      sector: updates.sector ? String(updates.sector).trim() : existing.sector,
      direccion: updates.direccion ? String(updates.direccion).trim() : existing.direccion,
      colegio_electoral: updates.colegio_electoral !== undefined ? String(updates.colegio_electoral).trim() : (existing.colegio_electoral || ''),
      verificado_partido: updates.verificado_partido !== undefined
        ? (updates.verificado_partido === true || updates.verificado_partido === 'true')
        : (existing.verificado_partido === true || existing.verificado_partido === 'true'),
      updated_at: new Date().toISOString()
    };

    // Si se actualiza la cédula
    if (updates.cedula && String(updates.cedula).trim() !== existing.cedula) {
      const cleanCedula = String(updates.cedula).trim();
      const newHash = cryptoService.hashBlindIndex(cleanCedula);

      // Validar si la nueva cédula no pertenece a otra persona
      const duplicate = await PersonaModel.findByCedulaHash(newHash);
      if (duplicate && duplicate.id !== id) {
        const err = new Error('El nuevo No. de Cédula ya pertenece a otra persona registrada.');
        err.status = 409;
        throw err;
      }
      updatedData.cedula_enc = cryptoService.encrypt(cleanCedula);
      updatedData.cedula_hash = newHash;
    }

    // Si se actualiza el teléfono
    if (updates.telefono && String(updates.telefono).trim() !== existing.telefono) {
      const cleanTelefono = String(updates.telefono).trim();
      updatedData.telefono_enc = cryptoService.encrypt(cleanTelefono);
    }

    // Si se actualiza el email
    if (updates.email !== undefined) {
      const cleanEmail = updates.email ? String(updates.email).trim().toLowerCase() : '';
      if (cleanEmail) {
        if (cleanEmail !== (existing.email || '').toLowerCase()) {
          updatedData.email_enc = cryptoService.encrypt(cleanEmail);
          updatedData.email_hash = cryptoService.hashBlindIndex(cleanEmail);
        }
      } else {
        updatedData.email_enc = null;
        updatedData.email_hash = null;
      }
    }

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .update(updatedData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return PersonaModel._decryptPersona(data);
      } catch (err) {
        console.warn('[PersonaModel Supabase] Error update, fallback local:', err.message);
      }
    }

    // Fallback local
    const personas = getLocalPersonas();
    const index = personas.findIndex(p => p.id === id);
    if (index === -1) return null;

    personas[index] = { ...personas[index], ...updatedData };
    saveLocalPersonas(personas);
    return PersonaModel._decryptPersona(personas[index]);
  }

  /**
   * Cambia el estado de una persona (Activar o Inactivar)
   */
  static async toggleActivo(id) {
    const existing = await PersonaModel.findById(id);
    if (!existing) {
      const err = new Error('Persona no encontrada.');
      err.status = 404;
      throw err;
    }

    const nuevoEstado = !existing.activo;

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .update({ activo: nuevoEstado, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return PersonaModel._decryptPersona(data);
      } catch (err) {
        console.warn('[PersonaModel Supabase] Error toggleActivo, fallback local:', err.message);
      }
    }

    const personas = getLocalPersonas();
    const index = personas.findIndex(p => p.id === id);
    if (index !== -1) {
      personas[index].activo = nuevoEstado;
      personas[index].updated_at = new Date().toISOString();
      saveLocalPersonas(personas);
      return PersonaModel._decryptPersona(personas[index]);
    }
    return null;
  }

  /**
   * Obtiene métricas y KPIs calculados para el Dashboard
   * Segmentada por sexo y sector, además de totales y activos/inactivos
   */
  static async getKpis() {
    let list = [];
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('id, nombre, sexo, sector, cedula_enc, activo, created_at');

        if (error) throw error;
        list = data || [];
      } catch (err) {
        console.warn('[PersonaModel Supabase] Fallback getKpis:', err.message);
        list = getLocalPersonas();
      }
    } else {
      list = getLocalPersonas();
    }

    const total = list.length;
    const activos = list.filter(p => p.activo).length;
    const inactivos = total - activos;

    // Segmentación por Sexo
    const porSexo = {
      M: 0,
      F: 0,
      Otro: 0
    };

    list.forEach(p => {
      if (porSexo[p.sexo] !== undefined) {
        porSexo[p.sexo]++;
      } else {
        porSexo.Otro++;
      }
    });

    // Segmentación por Sector (frecuencia ordenada)
    const sectorMap = {};
    list.forEach(p => {
      const s = (p.sector || 'Sin Sector').trim();
      sectorMap[s] = (sectorMap[s] || 0) + 1;
    });

    const porSector = Object.keys(sectorMap)
      .map(sector => ({ sector, cantidad: sectorMap[sector] }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // Registros recientes (últimos 7 días o registros)
    const ultimosRegistros = list
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(p => PersonaModel._decryptPersona(p));

    return {
      total,
      activos,
      inactivos,
      porSexo,
      porSector,
      ultimosRegistros
    };
  }

  /**
   * Obtiene todas las personas activas con sus datos de contacto descifrados
   * para el envío de boletines por Email o WhatsApp
   */
  static async findActivasParaBoletin() {
    let records = [];
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('*')
          .eq('activo', true);

        if (error) throw error;
        records = data || [];
      } catch (err) {
        console.warn('[PersonaModel Supabase] Fallback findActivasParaBoletin:', err.message);
        records = getLocalPersonas().filter(p => p.activo);
      }
    } else {
      records = getLocalPersonas().filter(p => p.activo);
    }

    return records.map(p => PersonaModel._decryptPersona(p));
  }

  /**
   * Método interno para descifrar campos protegidos antes de retornar al administrador
   */
  static _decryptPersona(record) {
    if (!record) return null;
    const cedula = cryptoService.decrypt(record.cedula_enc);
    const telefono = cryptoService.decrypt(record.telefono_enc);
    const email = record.email_enc ? cryptoService.decrypt(record.email_enc) : (record.email || '');

    return {
      ...record,
      verificado_partido: record.verificado_partido === true || record.verificado_partido === 'true',
      cedula,
      telefono,
      email,
      // Versiones enmascaradas para visualización opcional
      cedula_masked: cryptoService.maskCedula(cedula),
      telefono_masked: cryptoService.maskPhone(telefono),
      email_masked: email ? cryptoService.maskEmail(email) : ''
    };
  }
}

module.exports = PersonaModel;
