const { listarMigraciones } = require('../src/infrastructure/migraciones');
try {
  console.log('Secuencia SQL válida:', listarMigraciones().map(m => m.nombre).join(', '));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
