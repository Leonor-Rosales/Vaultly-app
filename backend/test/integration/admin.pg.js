const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { migrar } = require('../../src/infrastructure/migraciones');
const { crearAdminRepositorio } = require('../../src/infrastructure/adminRepositorio');
const { crearCasosAdministracion } = require('../../src/usecases/administracion');
const { hashear, comparar } = require('../../src/infrastructure/contrasenas');

test('PostgreSQL: persistencia, unicidad, hash, suscripciones y concurrencia administrativa', async t => {
  const url = new URL(process.env.TEST_ADMIN_DATABASE_URL || 'http://invalid');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/vaultly_admin_test', 'Usa una base local exclusiva vaultly_admin_test');
  const db = new Pool({ connectionString: url.toString() });
  t.after(() => db.end());
  await db.query('CREATE EXTENSION IF NOT EXISTS unaccent');
  const schema = 'admin_' + randomUUID().replaceAll('-', '');
  await db.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema},public` });
  t.after(() => pool.end());
  await migrar(pool, () => {});
  const repo = crearAdminRepositorio(pool), casos = crearCasosAdministracion({ repo, hashear });
  const { rows: [actor] } = await pool.query("INSERT INTO usuarios(rol_id,nombre_completo,correo_electronico,password_hash) VALUES((SELECT id FROM roles WHERE nombre='ADMIN'),'Inicial','inicial@example.test','fixture') RETURNING id");
  const datos = { nombre_completo: 'Segunda', correo_electronico: 'segunda@example.test', password: 'Segura123!', activo: true };
  const segundo = await casos.guardarAdministrador(actor.id, null, datos);
  assert.equal(segundo.password_hash, undefined);
  const hash = (await pool.query('SELECT password_hash FROM usuarios WHERE id=$1', [segundo.id])).rows[0].password_hash;
  assert.notEqual(hash, datos.password); assert.equal(await comparar(datos.password, hash), true);
  await assert.rejects(casos.guardarAdministrador(actor.id, null, { ...datos, correo_electronico: 'SEGUNDA@example.test' }), { estado: 409 });
  const editado = await casos.guardarAdministrador(actor.id, segundo.id, { ...datos, nombre_completo: 'Editada' });
  assert.equal(editado.nombre_completo, 'Editada');
  await assert.rejects(casos.guardarAdministrador(actor.id, actor.id, { ...datos, correo_electronico: 'inicial@example.test', activo: false }), /propia/);
  const cambios = await Promise.allSettled([
    casos.guardarAdministrador(actor.id, segundo.id, { ...datos, activo: false }),
    casos.guardarAdministrador(segundo.id, actor.id, { ...datos, correo_electronico: 'inicial@example.test', activo: false }),
  ]);
  assert.equal(cambios.filter(r => r.status === 'fulfilled').length, 1);
  const activos = (await repo.listarAdministradores()).filter(u => u.estado_cuenta === 'ACTIVO');
  assert.equal(activos.length, 1);
  const ultimo = activos[0];
  await assert.rejects(casos.guardarAdministrador(ultimo.id, ultimo.id, { ...datos, correo_electronico: ultimo.correo_electronico, activo: false }), /último/);
  const p = { nombre: 'Temporal', precio_mensual: 12.5, cuota_storage_gb: 20, limite_descargas: null, permite_carpetas_publicas: true, activo: true };
  const creado = await casos.guardarPlan(ultimo.id, null, p);
  await casos.guardarPlan(ultimo.id, creado.id, { ...p, cuota_storage_gb: 30 });
  const guardado = (await repo.listarPlanes()).find(x => x.id === creado.id);
  assert.equal(guardado.cuota_storage_gb, 30); assert.equal(guardado.limite_descargas, null);
  await pool.query("UPDATE suscripciones SET estado='VENCIDA' WHERE usuario_id=$1", [ultimo.id]);
  await pool.query("INSERT INTO suscripciones(usuario_id,plan_id,fecha_inicio,fecha_fin,estado) VALUES($1,$2,now(),now()+interval '30 days','ACTIVA')", [ultimo.id, creado.id]);
  const foto = (await pool.query('SELECT * FROM suscripciones')).rows;
  await assert.rejects(casos.guardarPlan(ultimo.id, creado.id, { ...p, precio_mensual: 40 }), /suscripciones/);
  await casos.guardarPlan(ultimo.id, creado.id, { ...guardado, precio_mensual: Number(guardado.precio_mensual), activo: false });
  assert.deepEqual((await pool.query('SELECT * FROM suscripciones')).rows, foto);
  assert.equal((await repo.listarPlanes()).find(x => x.id === creado.id).activo, false);
  const free = (await repo.listarPlanes()).find(x => x.nombre === 'Free');
  await assert.rejects(casos.guardarPlan(ultimo.id, free.id, { ...free, precio_mensual: 0, activo: false }), /Free/);
});
