require('dotenv').config();
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { Pool } = require('pg');
const { crearVistaPreviaRepositorio } = require('../../src/infrastructure/vistaPreviaRepositorio');
const { crearCasosVistasPrevias } = require('../../src/usecases/vistasPrevias');

test('cola PostgreSQL: migración, exclusión mutua, recuperación y eliminación durante conversión', async t => {
  assert.equal(process.env.TEST_VISTAS_PREVIAS, '1', 'Requiere TEST_VISTAS_PREVIAS=1 para crear un esquema temporal');
  const config = { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5433),
    database: process.env.DB_NAME || 'vaultly_db', user: process.env.DB_USER || 'vaultly_admin', password: process.env.DB_PASSWORD };
  assert.ok(['localhost', '127.0.0.1'].includes(config.host));
  const admin = new Pool(config);
  const schema = 'test_previas_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE SCHEMA ' + schema);
  const pool = new Pool({ ...config, options: '-c search_path=' + schema });
  t.after(async () => { await pool.end(); await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); await admin.end(); });
  await pool.query(`CREATE TABLE archivos(id uuid primary key, nombre_original text, tipo_mime text, nombre_objeto_minio text);
    CREATE TABLE migraciones_vaultly(nombre text primary key)`);
  const antiguo = randomUUID(), nuevo = randomUUID();
  await pool.query("INSERT INTO archivos VALUES($1,'antiguo.docx','application/octet-stream','objeto')", [antiguo]);
  const sql = fs.readFileSync('../init-db/09_vistas_previas.sql', 'utf8');
  await pool.query(sql); await pool.query(sql);
  assert.equal((await pool.query('SELECT count(*) FROM vistas_previas')).rows[0].count, '1');
  await pool.query("INSERT INTO archivos VALUES($1,'nuevo.xlsx','application/octet-stream','objeto')", [nuevo]);
  const repo = crearVistaPreviaRepositorio(pool);
  let convertido = 0, avisarInicio, continuar;
  const iniciado = new Promise(r => { avisarInicio = r; });
  const liberar = new Promise(r => { continuar = r; });
  const eliminados = [];
  const casos = crearCasosVistasPrevias({
    repo, almacenamiento: { guardarDerivado: async () => {}, eliminar: async clave => eliminados.push(clave) },
    convertir: async (_a, _f, guardar) => { convertido++; avisarInicio(); await liberar; await guardar({}); },
  });
  const primero = casos.procesarSiguiente();
  await iniciado;
  await casos.procesarSiguiente();
  assert.equal(convertido, 1);
  await pool.query('DELETE FROM archivos WHERE id=$1', [antiguo]);
  continuar(); await primero;
  await casos.procesarSiguiente();
  assert.equal(eliminados.length, 2);
  assert.equal((await pool.query('SELECT count(*) FROM vistas_previas WHERE id=$1', [antiguo])).rows[0].count, '0');
  await pool.query("UPDATE vistas_previas SET estado='PROCESANDO',intentos=1 WHERE id=$1", [nuevo]);
  await casos.procesarSiguiente();
  assert.equal((await repo.consultar(nuevo)).estado, 'LISTA');
  assert.equal(convertido, 2);
});
