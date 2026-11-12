require('dotenv').config();
const pool = require('../infrastructure/db');
const almacenamiento = require('../infrastructure/almacenamientoMinio');
const { crearVistaPreviaRepositorio } = require('../infrastructure/vistaPreviaRepositorio');
const { crearCasosVistasPrevias } = require('../usecases/vistasPrevias');
const { crearConversorOffice } = require('../infrastructure/conversorOffice');

const casos = crearCasosVistasPrevias({
  repo: crearVistaPreviaRepositorio(pool),
  almacenamiento,
  convertir: crearConversorOffice(almacenamiento),
});
let detener = false;
process.on('SIGTERM', () => { detener = true; });
process.on('SIGINT', () => { detener = true; });
async function ejecutar() {
  if (process.env.MIGRATE_ON_STARTUP !== 'false') {
    await require('../infrastructure/migraciones').migrar(pool);
  }
  console.log('Procesador de vistas previas iniciado');
  while (!detener) {
    try { await casos.procesarSiguiente(); }
    catch (error) { console.error('Procesador de vistas previas:', error.message); }
    if (!detener) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  await pool.end();
}
ejecutar().catch(error => { console.error(error.message); process.exitCode = 1; });
