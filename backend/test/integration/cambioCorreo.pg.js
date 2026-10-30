const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Pool } = require('pg');
const { migrar, listarMigraciones } = require('../../src/infrastructure/migraciones');
const { crearCambioCorreoRepositorio } = require('../../src/infrastructure/cambioCorreoRepositorio');
const { crearCasosCambioCorreo } = require('../../src/usecases/cambioCorreo');
const contrasenas = require('../../src/infrastructure/contrasenas');
const loadWith = require('../loadWith');

test('migración 08 preserva datos, es repetible; correo atómico y recuperación compatible', async t => {
  const url = new URL(process.env.TEST_ADMIN_DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/vaultly_admin_test', 'Usa exclusivamente vaultly_admin_test local');
  const db = new Pool({ connectionString: url.toString() }); t.after(() => db.end());
  await db.query('CREATE EXTENSION IF NOT EXISTS unaccent');
  const schema = 'correo_' + randomUUID().replaceAll('-', ''); await db.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema},public` }); t.after(() => pool.end());
  for (const m of listarMigraciones().filter(m => m.numero < 8)) await pool.query(m.sql);
  const hash = await contrasenas.hashear('Actual123!');
  const crear = async correo => (await pool.query("INSERT INTO usuarios(rol_id,nombre_completo,correo_electronico,password_hash) VALUES((SELECT id FROM roles WHERE nombre='ADMIN'),'Prueba',$1,$2) RETURNING *", [correo, hash])).rows[0];
  const u = await crear('antes@example.test');
  const snapshot = (await pool.query('SELECT * FROM suscripciones')).rows;
  await migrar(pool, () => {}); await migrar(pool, () => {});
  assert.deepEqual((await pool.query('SELECT * FROM suscripciones')).rows, snapshot);
  assert.equal((await pool.query('SELECT correo_electronico FROM usuarios WHERE id=$1', [u.id])).rows[0].correo_electronico, 'antes@example.test');
  assert.equal((await pool.query("SELECT count(*) n FROM migraciones_vaultly WHERE nombre='08_cambio_correo'")).rows[0].n, '1');
  const repoUsuarios = loadWith(path.resolve(__dirname, '../../src/infrastructure/usuarioRepositorio.js'), { './db': pool });
  assert.ok(await repoUsuarios.actualizarPassword(u.id, hash)); // Enlace antiguo válido antes del primer cambio.
  const enviados = []; const avisos = [];
  const casos = crearCasosCambioCorreo({ repo: crearCambioCorreoRepositorio(pool), contrasenas,
    codigos: { generar: () => '123456', id: randomUUID },
    correo: { enviarCodigo: async d => { enviados.push(d); }, notificarCambio: async d => { avisos.push(d); } } });
  const pedir = id => casos.solicitar(id, { correo: 'nuevo@example.test', password: 'Actual123!' });
  const r = await pedir(u.id);
  const row = (await pool.query('SELECT * FROM cambios_correo WHERE usuario_id=$1', [u.id])).rows[0];
  assert.notEqual(row.codigo_hash, '123456'); assert.ok(await contrasenas.comparar('123456', row.codigo_hash));
  const request = { solicitud_id: r.solicitud.id, codigo: '123456' };
  const results = await Promise.allSettled([casos.confirmar(u.id, request), casos.confirmar(u.id, request)]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(avisos.length, 1); assert.equal(avisos[0].para, 'antes@example.test');
  assert.equal(await repoUsuarios.actualizarPassword(u.id, hash), null, 'Enlace legado invalidado después del cambio');
  assert.equal(await repoUsuarios.actualizarPassword(u.id, hash, 'antes@example.test'), null);
  assert.ok(await repoUsuarios.actualizarPassword(u.id, hash, 'nuevo@example.test'));
  assert.deepEqual((await pool.query('SELECT * FROM suscripciones')).rows, snapshot);
  // Dos cuentas reservan el mismo correo: solo una puede confirmarlo.
  const a = await crear('a@example.test'), b = await crear('b@example.test');
  const datos = { correo: 'compartido@example.test', password: 'Actual123!' };
  const [ra, rb] = await Promise.all([casos.solicitar(a.id, datos), casos.solicitar(b.id, datos)]);
  const finales = await Promise.allSettled([
    casos.confirmar(a.id, { solicitud_id: ra.solicitud.id, codigo: '123456' }),
    casos.confirmar(b.id, { solicitud_id: rb.solicitud.id, codigo: '123456' }),
  ]);
  assert.equal(finales.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(finales.find(x => x.status === 'rejected').reason.codigo, 'CORREO_OCUPADO');
  assert.equal((await pool.query("SELECT count(*) n FROM usuarios WHERE correo_electronico='compartido@example.test'")).rows[0].n, '1');
});
