const fs = require('node:fs');
const path = require('node:path');
const { migrarEtiquetas } = require('./migrarEtiquetas');

const directorioSQL = path.resolve(__dirname, '../../../init-db');

function listarMigraciones(directorio = directorioSQL) {
  const prefijos = new Map();
  return fs.readdirSync(directorio).filter(nombre => nombre.endsWith('.sql')).map(nombre => {
    const coincidencia = /^(\d+)_.*\.sql$/.exec(nombre);
    if (!coincidencia) throw new Error(`Migración sin prefijo numérico: ${nombre}`);
    const numero = Number(coincidencia[1]);
    if (prefijos.has(numero)) {
      throw new Error(`Prefijo de migración duplicado ${coincidencia[1]}: ${prefijos.get(numero)} y ${nombre}`);
    }
    prefijos.set(numero, nombre);
    return { numero, nombre, id: nombre.slice(0, -4), sql: fs.readFileSync(path.join(directorio, nombre), 'utf8') };
  }).sort((a, b) => a.numero - b.numero);
}

async function migrar(pool, registrar = console.log) {
  // Validar antes de conectar o modificar la base.
  const migraciones = listarMigraciones();
  const client = await pool.connect();
  try {
    // Serializa invocaciones completas, además del bloqueo transaccional de cada SQL.
    await client.query('SELECT pg_advisory_lock(7102027)');
    for (const migracion of migraciones) {
      if (migracion.numero === 1) {
        const { rows } = await client.query("SELECT to_regclass('roles') AS tabla");
        if (rows[0].tabla) continue; // Nunca recrear el esquema de una instalación existente.
      } else if (migracion.numero > 2) {
        const { rows } = await client.query("SELECT to_regclass('migraciones_vaultly') AS tabla");
        if (rows[0].tabla) {
          const aplicada = await client.query('SELECT 1 FROM migraciones_vaultly WHERE nombre=$1', [migracion.id]);
          if (aplicada.rowCount) continue;
        }
      }
      // Los SQL conservan sus transacciones e identificadores históricos.
      await client.query(migracion.sql);
      registrar(`Migración ${migracion.nombre} aplicada.`);
    }
    // Reutilizar la conexión bloqueada; migrarEtiquetas administra su propia transacción.
    await migrarEtiquetas({ connect: async () => ({ query: client.query.bind(client), release() {} }) });
    registrar('Migración de etiquetas aplicada (idempotente).');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(7102027)'); }
    finally { client.release(); }
  }
}

module.exports = { listarMigraciones, migrar };
