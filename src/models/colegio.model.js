const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isConfigured } = require('../config/supabase');

const LOCAL_DATA_DIR = path.resolve(__dirname, '../../data');
const LOCAL_COLEGIOS_FILE = path.join(LOCAL_DATA_DIR, 'colegios.json');

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function getLocalColegios() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_COLEGIOS_FILE)) {
    fs.writeFileSync(LOCAL_COLEGIOS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_COLEGIOS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalColegios(list) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_COLEGIOS_FILE, JSON.stringify(list, null, 2));
}

class ColegioModel {
  /**
   * Obtiene todos los colegios con filtros de búsqueda
   */
  static async findAll({ search = '', sector = '', municipio = '', activo = '' } = {}) {
    let list = [];

    if (isConfigured && supabase) {
      try {
        let query = supabase.from('colegios_electorales').select('*').order('created_at', { ascending: false });
        if (activo !== '') {
          query = query.eq('activo', activo === 'true');
        }
        if (sector) {
          query = query.ilike('sector', `%${sector}%`);
        }
        if (municipio) {
          query = query.ilike('municipio', `%${municipio}%`);
        }
        const { data, error } = await query;
        if (!error && data) {
          list = data;
        } else {
          list = getLocalColegios();
        }
      } catch {
        list = getLocalColegios();
      }
    } else {
      list = getLocalColegios();
    }

    // Filtrado en memoria
    if (activo !== '') {
      const boolVal = activo === 'true';
      list = list.filter(c => Boolean(c.activo) === boolVal);
    }
    if (sector) {
      list = list.filter(c => c.sector && c.sector.toLowerCase() === sector.toLowerCase());
    }
    if (municipio) {
      list = list.filter(c => c.municipio && c.municipio.toLowerCase() === municipio.toLowerCase());
    }
    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        (c.codigo && c.codigo.toLowerCase().includes(q)) ||
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.sector && c.sector.toLowerCase().includes(q)) ||
        (c.municipio && c.municipio.toLowerCase().includes(q)) ||
        (c.direccion && c.direccion.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  /**
   * Busca un colegio por su ID
   */
  static async findById(id) {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('colegios_electorales')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch {
        // Fallback local
      }
    }

    const localList = getLocalColegios();
    return localList.find(c => c.id === id) || null;
  }

  /**
   * Busca un colegio por su código
   */
  static async findByCodigo(codigo) {
    const cleanCodigo = String(codigo).trim().toUpperCase();

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('colegios_electorales')
          .select('*')
          .ilike('codigo', cleanCodigo)
          .single();
        if (!error && data) return data;
      } catch {
        // Fallback local
      }
    }

    const localList = getLocalColegios();
    return localList.find(c => c.codigo && c.codigo.toUpperCase() === cleanCodigo) || null;
  }

  /**
   * Registra un nuevo colegio electoral
   */
  static async create({
    codigo,
    nombre,
    municipio,
    sector,
    direccion,
    mesas = 1,
    electores = 0
  }) {
    const cleanCodigo = String(codigo).trim().toUpperCase();
    const cleanNombre = String(nombre).trim();
    const cleanMunicipio = String(municipio).trim();
    const cleanSector = String(sector).trim();
    const cleanDireccion = String(direccion).trim();

    // Validar unicidad del código
    const existing = await ColegioModel.findByCodigo(cleanCodigo);
    if (existing) {
      const err = new Error(`Ya existe un Colegio Electoral con el código "${cleanCodigo}".`);
      err.status = 409;
      throw err;
    }

    const record = {
      id: crypto.randomUUID() ? crypto.randomUUID() : 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      codigo: cleanCodigo,
      nombre: cleanNombre,
      municipio: cleanMunicipio,
      sector: cleanSector,
      direccion: cleanDireccion,
      mesas: parseInt(mesas, 10) || 1,
      electores: parseInt(electores, 10) || 0,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('colegios_electorales')
          .insert([record])
          .select()
          .single();
        if (!error && data) {
          const list = getLocalColegios();
          list.unshift(data);
          saveLocalColegios(list);
          return data;
        }
      } catch (err) {
        console.warn('[ColegioModel Supabase] Error al crear, usando almacenamiento local:', err.message);
      }
    }

    const list = getLocalColegios();
    list.unshift(record);
    saveLocalColegios(list);
    return record;
  }

  /**
   * Alterna el estado activo / inactivo
   */
  static async toggleStatus(id) {
    const colegio = await ColegioModel.findById(id);
    if (!colegio) {
      const err = new Error('Colegio electoral no encontrado.');
      err.status = 404;
      throw err;
    }

    const nuevoEstado = !colegio.activo;

    if (isConfigured && supabase) {
      try {
        await supabase
          .from('colegios_electorales')
          .update({ activo: nuevoEstado, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err) {
        console.warn('[ColegioModel Supabase] Error al cambiar estado:', err.message);
      }
    }

    const list = getLocalColegios();
    const index = list.findIndex(c => c.id === id);
    if (index !== -1) {
      list[index].activo = nuevoEstado;
      list[index].updated_at = new Date().toISOString();
      saveLocalColegios(list);
    }

    return { ...colegio, activo: nuevoEstado };
  }

  /**
   * Precarga datos de demostración si la base está vacía
   */
  static async seedInitialColegios() {
    const list = await ColegioModel.findAll();
    if (list.length > 0) return;

    console.log('[Seed] Precargando Colegios Electorales de demostración...');
    const muestras = [
      {
        codigo: '0012A',
        nombre: 'Colegio Claret',
        municipio: 'Distrito Nacional',
        sector: 'Piantini',
        direccion: 'Calle John F. Kennedy esq. Lope de Vega',
        mesas: 6,
        electores: 3200
      },
      {
        codigo: '0045B',
        nombre: 'Liceo Experimental UASD',
        municipio: 'Distrito Nacional',
        sector: 'Gazcue',
        direccion: 'Av. Dr. Bernardo Correa y Cidrón',
        mesas: 8,
        electores: 4600
      },
      {
        codigo: '0089A',
        nombre: 'Escuela Primaria República de Chile',
        municipio: 'Distrito Nacional',
        sector: 'San Carlos',
        direccion: 'Calle Abreu #54',
        mesas: 4,
        electores: 2150
      },
      {
        codigo: '0104C',
        nombre: 'Escuela Benito Juárez',
        municipio: 'Distrito Nacional',
        sector: 'Bella Vista',
        direccion: 'Av. Sarasota #48',
        mesas: 5,
        electores: 2800
      },
      {
        codigo: '0210A',
        nombre: 'Liceo Ramón Emilio Jiménez',
        municipio: 'Santo Domingo Este',
        sector: 'Los Mina',
        direccion: 'Av. San Vicente de Paúl esq. Av. Venezuela',
        mesas: 10,
        electores: 5400
      }
    ];

    for (const m of muestras) {
      try {
        await ColegioModel.create(m);
      } catch (e) {
        // Ignorar si ya existe
      }
    }
    console.log('[Seed] Colegios electorales de demostración creados con éxito.');
  }
}

module.exports = ColegioModel;

