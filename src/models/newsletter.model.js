const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isConfigured } = require('../config/supabase');

const LOCAL_DATA_DIR = path.resolve(__dirname, '../../data');
const LOCAL_BOLETINES_FILE = path.join(LOCAL_DATA_DIR, 'boletines.json');

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function getLocalBoletines() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_BOLETINES_FILE)) {
    fs.writeFileSync(LOCAL_BOLETINES_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_BOLETINES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalBoletines(list) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_BOLETINES_FILE, JSON.stringify(list, null, 2));
}

class NewsletterModel {
  static async create({ titulo, mensaje, canal, destinatarios_count, imagenes = [], enviado_por }) {
    const record = {
      id: crypto.randomUUID() ? crypto.randomUUID() : 'bol_' + Date.now(),
      titulo,
      mensaje,
      canal,
      destinatarios_count,
      imagenes: imagenes || [],
      enviado_por,
      created_at: new Date().toISOString()
    };

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('boletines')
          .insert([record])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[NewsletterModel Supabase] Error insert boletin, fallback local:', err.message);
      }
    }

    const list = getLocalBoletines();
    list.unshift(record);
    saveLocalBoletines(list);
    return record;
  }

  static async findAll() {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('boletines')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('[NewsletterModel Supabase] Fallback findAll:', err.message);
      }
    }

    return getLocalBoletines();
  }
}

module.exports = NewsletterModel;
