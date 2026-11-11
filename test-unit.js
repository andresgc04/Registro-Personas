const assert = require('assert');
const PersonaModel = require('./src/models/persona.model');
const AdminModel = require('./src/models/admin.model');
const cryptoService = require('./src/services/crypto.service');

async function testUnit() {
  console.log('--- Probando Servicio Criptográfico AES-256-GCM + Blind Index ---');
  
  const testCedula = '402-1234567-9';
  const encCedula = cryptoService.encrypt(testCedula);
  const decCedula = cryptoService.decrypt(encCedula);
  assert.strictEqual(decCedula, testCedula, 'Descifrado de cédula debe coincidir exactamente');
  
  const blindIndex1 = cryptoService.hashBlindIndex(testCedula);
  const blindIndex2 = cryptoService.hashBlindIndex(' 402-1234567-9 ');
  assert.strictEqual(blindIndex1, blindIndex2, 'Blind Index debe ser determinístico y normalizado');
  console.log('✅ Cifrado AES-256-GCM y Blind Index validados con éxito.');

  console.log('--- Probando Modelo de Personas y Descifrado Seguro ---');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const personaCreada = await PersonaModel.create({
    nombre: 'Valeria',
    apellido: 'Hernández',
    sexo: 'F',
    cedula: `001-776${randomSuffix}-3`,
    telefono: '809-555-9988',
    sector: 'Bella Vista',
    direccion: 'Av. Sarasota #40',
    email: `valeria.${randomSuffix}@ejemplo.com`,
    origen_registro: 'publico'
  });

  assert.strictEqual(personaCreada.nombre, 'Valeria');
  assert.strictEqual(personaCreada.cedula, `001-776${randomSuffix}-3`);
  assert.strictEqual(personaCreada.email, `valeria.${randomSuffix}@ejemplo.com`);
  console.log('✅ Persona creada y descifrada en memoria para admin:', personaCreada.nombre, personaCreada.cedula);

  console.log('--- Probando KPIs del Dashboard ---');
  const kpis = await PersonaModel.getKpis();
  assert(kpis.total >= 1, 'Total de personas debe ser >= 1');
  assert(kpis.porSexo.F >= 1, 'Debe haber al menos 1 mujer contabilizada en el KPI por sexo');
  assert(kpis.porSector.length >= 1, 'Debe haber al menos un sector contabilizado');
  console.log('✅ KPIs validados:', { total: kpis.total, porSexo: kpis.porSexo, topSector: kpis.porSector[0] });

  console.log('--- Probando Alternancia de Estado (Activar/Inactivar) ---');
  const personaInactivada = await PersonaModel.toggleActivo(personaCreada.id);
  assert.strictEqual(personaInactivada.activo, false, 'La persona debe quedar inactiva');
  const personaReactivada = await PersonaModel.toggleActivo(personaCreada.id);
  assert.strictEqual(personaReactivada.activo, true, 'La persona debe quedar activa nuevamente');
  console.log('✅ Toggle de estado Activo/Inactivo validado.');

  console.log('--- Todas las validaciones de lógica de negocio y seguridad son 100% exitosas ---');
}

testUnit().catch(err => {
  console.error('Error en pruebas unitarias:', err);
  process.exit(1);
});
