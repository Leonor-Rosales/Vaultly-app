require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/infrastructure/db');

(async () => {
  try {
    for (const nombre of ['03_planes_cuotas.sql', '04_descargas_biblioteca.sql']) {
      const sql = fs.readFileSync(path.resolve(__dirname, '../../init-db', nombre), 'utf8');
      await pool.query(sql);
      console.log(`Migración ${nombre} aplicada (idempotente).`);
    }
  } catch (error) {
    console.error('Migración fallida:', error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
