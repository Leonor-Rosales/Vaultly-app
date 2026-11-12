require('dotenv').config();
const { crearServidorVistasPrevias } = require('./servidorVistasPrevias');

function iniciar() {
  const secreto = process.env.VISTAS_PREVIAS_SECRET;
  // Validar el secreto antes de construir clientes de infraestructura.
  if (!secreto || secreto.length < 32) throw new Error('VISTAS_PREVIAS_SECRET debe tener al menos 32 caracteres');
  const pool = require('../infrastructure/db');
  const almacenamiento = require('../infrastructure/almacenamientoMinio');
  const { crearVistaPreviaRepositorio } = require('../infrastructure/vistaPreviaRepositorio');
  const { crearCasosVistasPrevias } = require('../usecases/vistasPrevias');
  const { crearConversorOffice } = require('../infrastructure/conversorOffice');
  const casos = crearCasosVistasPrevias({
    repo: crearVistaPreviaRepositorio(pool), almacenamiento,
    convertir: crearConversorOffice(almacenamiento),
  });
  const servidor = crearServidorVistasPrevias({ procesarSiguiente: casos.procesarSiguiente, secreto });
  const puerto = Number(process.env.PORT || 8080);
  servidor.listen(puerto, '0.0.0.0', () => console.log(`Conversor HTTP en puerto ${puerto}`));
  process.once('SIGTERM', () => {
    servidor.close(() => { void pool.end(); });
  });
  return servidor;
}

if (require.main === module) {
  try { iniciar(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { iniciar };
