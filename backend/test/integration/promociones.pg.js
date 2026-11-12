const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { migrar } = require('../../src/infrastructure/migraciones');
const { crearAdminRepositorio } = require('../../src/infrastructure/adminRepositorio');
const { crearCasosAdministracion } = require('../../src/usecases/administracion');
const { crearPagosRepositorio } = require('../../src/infrastructure/pagosRepositorio');
const { crearCasosPagos } = require('../../src/usecases/pagos');
const { crearCuotasRepositorio } = require('../../src/infrastructure/cuotasRepositorio');
const { crearCasosCuotas } = require('../../src/usecases/cuotas');

test('promoción gratuita conserva el período, renueva al habitual solo con consentimiento y expone auditoría segura', async t => {
  const url = new URL(process.env.TEST_MIGRATIONS_DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname) && url.pathname === '/vaultly_migraciones_test');
  const db = new Pool({ connectionString: url.toString() });
  const schema = 'promociones_' + randomUUID().replaceAll('-', ''); await db.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema},public` });
  t.after(async () => { await pool.end(); await db.query(`DROP SCHEMA ${schema} CASCADE`); await db.end(); });
  await migrar(pool, () => {}); await migrar(pool, () => {});
  const actor = randomUUID(), clientes = [randomUUID(),randomUUID(),randomUUID()];
  for (const [i,id] of [actor,...clientes].entries()) await pool.query("INSERT INTO usuarios(id,rol_id,nombre_completo,correo_electronico,password_hash) VALUES($1,$2,$3,$4,'fixture')", [id,i===0?1:2,`Usuario ${i}`,`${id}@example.test`]);
  const repo = crearAdminRepositorio(pool);
  const admin = crearCasosAdministracion({ repo, hashear: async () => 'hash-fixture' });
  let plan = await admin.guardarPlan(actor, null, { nombre:'Max Promoción',precio_mensual:200,cuota_storage_gb:100,limite_descargas:null,activo:true,permite_carpetas_publicas:true,promocion_precio:0,promocion_inicio:'2026-11-01T06:00:00Z',promocion_fin:'2026-11-20T06:00:00Z' });
  let ahora = new Date('2026-11-11T18:00:00Z');
  const crono = repo => ({ ...repo, conUsuario: (id, fn) => repo.conUsuario(id, tx => { tx.ahora = ahora; return fn(tx); }) });
  const pagos = crearCasosPagos({ repo: crono(crearPagosRepositorio(pool)) });
  const cuotas = crearCasosCuotas({ repo: crono(crearCuotasRepositorio(pool)), almacenamiento:{} });
  for (const [i, cliente] of clientes.slice(0,2).entries()) {
    const pago = await pagos.contratar(cliente,{planId:plan.id,versionPlan:plan.version,precioConfirmado:0,metodo:'tarjeta',renovar:i===0});
    assert.equal(pago.monto,0); assert.equal(pago.comprobante.promocion.precioHabitual,200);
    assert.equal(pago.comprobante.fin,'2026-12-11T18:00:00.000Z');
  }
  ahora = new Date('2026-11-21T18:00:00Z'); // Terminó la oferta, pero no el período adquirido.
  const vigente = await cuotas.consultar(clientes[0]);
  assert.equal(vigente.plan.id,plan.id);
  assert.equal(new Date(vigente.suscripcion.fecha_fin).toISOString(),'2026-12-11T18:00:00.000Z');
  assert.equal((await pagos.historial(clientes[0])).length,1);
  // Permite configurar una promoción nueva en un plan utilizado sin cambiar los beneficios.
  plan = await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,promocion_precio:0,promocion_inicio:'2026-11-01T06:00:00Z',promocion_fin:'2026-12-30T06:00:00Z'});
  ahora = new Date('2026-12-11T18:00:01Z');
  assert.equal((await cuotas.consultar(clientes[0])).plan.id, plan.id);
  assert.equal((await pagos.historial(clientes[0]))[0].monto,200); // Aun con otra promoción vigente.
  assert.equal((await cuotas.consultar(clientes[1])).plan.nombre,'Free');
  assert.equal((await pagos.historial(clientes[1])).length,1);
  // Vencer una promoción no exige un trabajo programado ni modificar el precio base.
  ahora = new Date('2026-12-30T06:00:00Z');
  await assert.rejects(async () => pagos.contratar(clientes[2],{planId:plan.id,versionPlan:plan.version,precioConfirmado:0,metodo:'tarjeta'}),{codigo:'PLAN_DESACTUALIZADO'});
  assert.equal((await pagos.historial(clientes[2])).length,0);
  const normal = await pagos.contratar(clientes[2],{planId:plan.id,versionPlan:plan.version,precioConfirmado:200,metodo:'tarjeta'});
  assert.equal(normal.monto,200);
  const cuenta = await admin.guardarAdministrador(actor,null,{nombre_completo:'Nuevo admin',correo_electronico:'nuevo@example.test',password:'Segura123!',activo:true});
  await admin.guardarAdministrador(actor,cuenta.id,{nombre_completo:'Nuevo admin',correo_electronico:'nuevo@example.test',activo:false});
  const log = await admin.listarAuditoria({pagina:'1',q:'Nuevo admin'});
  assert.deepEqual(new Set(log.items.map(e=>e.codigo)),new Set(['ADMIN_CREADO','ADMIN_DESACTIVADO']));
  assert.equal(JSON.stringify(log).includes('hash-fixture'),false);
  assert.ok(log.items.every(e=>e.usuario_id===actor));
  const promos = await admin.listarAuditoria({pagina:'1',accion:'PLAN_EDITADO',q:'Max'});
  assert.equal(promos.total,1); assert.equal(promos.items[0].detalles_json.nuevo.promocion_precio,'0.00');
  assert.equal((await admin.listarAuditoria({pagina:'1',q:"' OR 1=1 --"})).total,0);
});
