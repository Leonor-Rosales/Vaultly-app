const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { listarMigraciones, migrar } = require('../../src/infrastructure/migraciones');
const { crearPagosRepositorio } = require('../../src/infrastructure/pagosRepositorio');
const { crearCuotasRepositorio } = require('../../src/infrastructure/cuotasRepositorio');
const { crearCasosPagos } = require('../../src/usecases/pagos');
const { crearCasosCuotas } = require('../../src/usecases/cuotas');
const { crearAdminRepositorio } = require('../../src/infrastructure/adminRepositorio');

test('catálogo USD: sustituye pruebas, conserva pagos y consumo y migra una sola vez', async t => {
  const url = new URL(process.env.TEST_MIGRATIONS_DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/vaultly_migraciones_test');
  const admin = new Pool({ connectionString: url.toString() });
  const schema = 'catalogo_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema},public` });
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  for (const m of listarMigraciones().filter(m => m.numero < 18)) await pool.query(m.sql);
  const usuario = randomUUID();
  await pool.query("INSERT INTO usuarios(id,rol_id,nombre_completo,correo_electronico,password_hash) VALUES($1,2,'Prueba USD',$2,'fixture')", [usuario, `${usuario}@example.test`]);
  const { rows: [anterior] } = await pool.query("UPDATE planes SET precio_mensual=50,promocion_tipo='FIJO',promocion_precio=40,promocion_inicio=now()-interval '1 day',promocion_fin=now()+interval '1 day' WHERE nombre='Basic Open' RETURNING *");
  // Antes de la migración, la moneda del catálogo era GTQ.
  const casos = crearCasosPagos({ repo: crearPagosRepositorio(pool) });
  const pago = await casos.contratar(usuario, { planId: anterior.id, versionPlan: anterior.version, precioConfirmado: 40, metodo: 'tarjeta', renovar: true });
  await pool.query("UPDATE pagos SET comprobante=jsonb_set(comprobante,'{moneda}','\"GTQ\"') WHERE id=$1", [pago.id]);
  const historico = (await casos.historial(usuario))[0];
  await pool.query("UPDATE suscripciones SET descargas_consumidas_ciclo=3 WHERE usuario_id=$1 AND estado='ACTIVA'", [usuario]);
  await pool.query("INSERT INTO ciclos_descargas(usuario_id,inicio,fin,consumidas) VALUES($1,date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC',3) ON CONFLICT(usuario_id,inicio) DO UPDATE SET consumidas=3", [usuario]);
  await pool.query("INSERT INTO planes(nombre,precio_mensual,cuota_storage_gb,limite_descargas) VALUES('Otro plan anterior',90,20,10)");
  await migrar(pool, () => {});
  const { rows: planes } = await pool.query("SELECT nombre,cuota_storage_gb,limite_descargas,precio_mensual,moneda FROM planes WHERE nombre <> 'Otro plan anterior' ORDER BY precio_mensual");
  assert.deepEqual(planes, [
    { nombre:'Free', cuota_storage_gb:5, limite_descargas:5, precio_mensual:'0.00', moneda:'USD' },
    { nombre:'Basic Open', cuota_storage_gb:15, limite_descargas:50, precio_mensual:'1.20', moneda:'USD' },
    { nombre:'Pro Developer', cuota_storage_gb:50, limite_descargas:200, precio_mensual:'2.50', moneda:'USD' },
    { nombre:'Max Vault', cuota_storage_gb:100, limite_descargas:500, precio_mensual:'3.80', moneda:'USD' },
  ]);
  assert.deepEqual((await casos.historial(usuario))[0], historico);
  const { rows: [actual] } = await pool.query('SELECT * FROM planes WHERE id=$1', [anterior.id]);
  assert.ok(actual.version > anterior.version);
  assert.equal(actual.promocion_precio, null);
  assert.equal(actual.promocion_tipo, null);
  assert.equal((await pool.query("SELECT moneda FROM planes WHERE nombre='Otro plan anterior'")).rows[0].moneda, 'GTQ');
  const cuotas = crearCasosCuotas({ repo: crearCuotasRepositorio(pool), almacenamiento: {} });
  const consumo = await cuotas.consultar(usuario);
  assert.equal(consumo.descargas.limite, 50);
  assert.equal(consumo.descargas.consumidas, 3);
  await assert.rejects(casos.contratar(usuario, { planId: actual.id, versionPlan: anterior.version, precioConfirmado:40, metodo:'tarjeta' }), { codigo: 'PLAN_DESACTUALIZADO' });
  await pool.query("UPDATE suscripciones SET estado='VENCIDA' WHERE usuario_id=$1 AND estado='ACTIVA'", [usuario]);
  const nuevo = await casos.contratar(usuario, { planId: actual.id, versionPlan: actual.version, precioConfirmado:1.2, metodo:'tarjeta', renovar:true });
  assert.equal(nuevo.monto, 1.2);
  assert.equal(nuevo.comprobante.moneda, 'USD');
  const pagosAdmin = await crearAdminRepositorio(pool).listarPagos();
  assert.equal(pagosAdmin.find(p => p.id === historico.id).moneda, 'GTQ');
  assert.equal(pagosAdmin.find(p => p.id === nuevo.id).moneda, 'USD');
  const { rows: [suscripcion] } = await pool.query("SELECT fecha_fin FROM suscripciones WHERE usuario_id=$1 AND estado='ACTIVA'", [usuario]);
  const repo = crearCuotasRepositorio(pool);
  const reloj = { ...repo, conUsuario: (id, fn) => repo.conUsuario(id, tx => { tx.ahora = new Date(+suscripcion.fecha_fin + 1000); return fn(tx); }) };
  await crearCasosCuotas({ repo: reloj, almacenamiento: {} }).consultar(usuario);
  const renovado = (await casos.historial(usuario)).find(p => ![historico.id, nuevo.id].includes(p.id));
  assert.equal(renovado.monto, 1.2);
  assert.equal(renovado.comprobante.moneda, 'USD');
  // Repetir el arranque conserva posteriores cambios de administración.
  await pool.query('UPDATE planes SET limite_descargas=51 WHERE id=$1', [actual.id]);
  await migrar(pool, () => {});
  assert.equal((await pool.query('SELECT limite_descargas FROM planes WHERE id=$1', [actual.id])).rows[0].limite_descargas, 51);
});
