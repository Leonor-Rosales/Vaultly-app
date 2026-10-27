require('dotenv').config();
const pool = require('../src/infrastructure/db');
const { migrar } = require('../src/infrastructure/migraciones');

(async () => {
  try {
    await migrar(pool);
  } catch (error) {
    console.error('Migración fallida:', error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
