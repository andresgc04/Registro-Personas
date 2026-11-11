const app = require('./src/app');
const config = require('./src/config/env');
const AdminModel = require('./src/models/admin.model');
const PersonaModel = require('./src/models/persona.model');
const ColegioModel = require('./src/models/colegio.model');

async function startServer() {
  try {
    // 1. Inicializar credenciales del Administrador por defecto si no existen
    await AdminModel.seedInitialAdmin();

    // 2. Si no hay registros de personas, precargar ejemplos ilustrativos con datos cifrados
    const existentes = await PersonaModel.findAll();
    if (existentes.length === 0) {
      console.log('[Seed] Precargando registros de demostración con cifrado AES-256...');
      const muestras = [
        {
          nombre: 'Juan Carlos',
          apellido: 'Rosario Marte',
          sexo: 'M',
          cedula: '001-1234567-8',
          telefono: '809-555-0101',
          sector: 'Piantini',
          direccion: 'Calle Federico Geraldino #45, Apto 3B',
          email: 'juan.rosario@ejemplo.com',
          origen_registro: 'admin'
        },
        {
          nombre: 'María Elena',
          apellido: 'Gómez Santos',
          sexo: 'F',
          cedula: '402-9876543-2',
          telefono: '829-555-0202',
          sector: 'Bella Vista',
          direccion: 'Av. Sarasota #12, Edif. Altagracia',
          email: 'maria.gomez@ejemplo.com',
          origen_registro: 'publico'
        },
        // {
        //   nombre: 'Carlos Manuel',
        //   apellido: 'Peña Ventura',
        //   sexo: 'M',
        //   cedula: '001-4567890-1',
        //   telefono: '849-555-0303',
        //   sector: 'Gazcue',
        //   direccion: 'Calle Dr. Delgado #78',
        //   email: 'carlos.pena@ejemplo.com',
        //   origen_registro: 'admin'
        // },
        // {
        //   nombre: 'Laura Patricia',
        //   apellido: 'Almonte Morales',
        //   sexo: 'F',
        //   cedula: '002-3344556-7',
        //   telefono: '809-555-0404',
        //   sector: 'Piantini',
        //   direccion: 'Calle Manuel de Jesús Troncoso #10',
        //   email: 'laura.almonte@ejemplo.com',
        //   origen_registro: 'publico'
        // },
        // {
        //   nombre: 'Alex',
        //   apellido: 'Santana Díaz',
        //   sexo: 'Otro',
        //   cedula: '001-8899776-5',
        //   telefono: '829-555-0505',
        //   sector: 'Los Mina',
        //   direccion: 'Calle San Vicente de Paúl #204',
        //   email: 'alex.santana@ejemplo.com',
        //   origen_registro: 'publico'
        // }
      ];

      for (const m of muestras) {
        try {
          await PersonaModel.create(m);
        } catch (e) {
          // Ignorar si ya existen
        }
      }
      console.log('[Seed] Registros de muestra creados y cifrados con éxito.');
    }

    // 3. Inicializar Colegios Electorales de muestra si no existen
    await ColegioModel.seedInitialColegios();

    // 4. Iniciar escucha en puerto
    app.listen(config.PORT, () => {
      console.log(`=======================================================`);
      console.log(`  SISTEMA DE REGISTRO DE PERSONAS - MVC OWASP PRO    `);
      console.log(`=======================================================`);
      console.log(`  Servidor activo en: http://localhost:${config.PORT}`);
      console.log(`  Portal Administrativo: http://localhost:${config.PORT}/auth/login`);
      console.log(`  Link Público de Registro: http://localhost:${config.PORT}/registro`);
      console.log(`  Credenciales de acceso:`);
      console.log(`    Usuario: ${config.INITIAL_ADMIN_EMAIL}`);
      console.log(`    Contraseña: ${config.INITIAL_ADMIN_PASSWORD}`);
      console.log(`  Seguridad: AES-256-GCM + Blind Index HMAC-SHA256`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Error fatal al iniciar la aplicación:', error);
    process.exit(1);
  }
}

startServer();
