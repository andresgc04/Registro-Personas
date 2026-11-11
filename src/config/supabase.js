const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

let supabase = null;
let isConfigured = false;

if (
  config.SUPABASE_URL &&
  config.SUPABASE_URL.startsWith('http') &&
  (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY)
) {
  try {
    const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
    supabase = createClient(config.SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    isConfigured = true;
    console.log('[Supabase] Cliente inicializado correctamente.');
  } catch (err) {
    console.warn('[Supabase] Error al inicializar cliente:', err.message);
    isConfigured = false;
  }
} else {
  console.log('[Supabase] Credenciales no configuradas en .env. Modo Local / Storage Activo.');
}

module.exports = {
  supabase,
  isConfigured
};
