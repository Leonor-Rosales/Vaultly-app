const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCasosPagos } = require('../src/usecases/pagos');
const { crearCasosAdministracion } = require('../src/usecases/administracion');
const base = { id: 2, version: 1, nombre: 'Pro', precio_mensual: 49, cuota_storage_gb: 50, limite_descargas: null, permite_carpetas_publicas: false, activo: true };

test('versiones de compra ausentes o antiguas no crean pago ni suscripción', async () => {
  let escrituras = 0;
  const tx = { plan: async () => ({ ...base, version: 2 }), crearSuscripcion: async () => { escrituras++; }, registrarPago: async () => { escrituras++; } };
  const casos = crearCasosPagos({ repo: { conUsuario: (_id, fn) => fn(tx) } });
  for (const versionPlan of [undefined, null, 0, -1, 1, 3, '2']) {
    await assert.rejects(async () => casos.contratar('u', { planId: 2, versionPlan, metodo: 'tarjeta' }), { codigo: 'PLAN_DESACTUALIZADO' });
  }
  assert.equal(escrituras, 0);
});

test('formularios antiguos no sobrescriben un cambio ni generan auditoría de éxito', async () => {
  let escrituras = 0;
  const tx = { actor: async () => ({ rol: 'ADMIN', estado_cuenta: 'ACTIVO' }), plan: async () => ({ ...base, version: 2 }),
    guardarPlan: async () => { escrituras++; }, auditarPlan: async () => { escrituras++; } };
  const casos = crearCasosAdministracion({ repo: { transaccion: (_tipo, fn) => fn(tx) } });
  for (const version of [undefined, 0, 1, '2']) await assert.rejects(casos.guardarPlan('a', 2, { ...base, version, precio_mensual: 99 }), { codigo: 'PLAN_DESACTUALIZADO' });
  assert.equal(escrituras, 0);
});

test('solo Free admite precio cero; planes gratuitos antiguos pueden retirarse', async () => {
  let auditado = 0;
  const tx = { actor: async () => ({ rol: 'ADMIN', estado_cuenta: 'ACTIVO' }), plan: async () => ({ ...base, precio_mensual: 0 }), usado: async () => false,
    guardarPlan: async (_id, d) => ({ ...d, id: 2, version: 2 }), auditarPlan: async () => { auditado++; } };
  const casos = crearCasosAdministracion({ repo: { transaccion: (_tipo, fn) => fn(tx) } });
  await assert.rejects(casos.guardarPlan('a', null, { ...base, precio_mensual: 0 }), { codigo: 'PRECIO_CERO_NO_PERMITIDO' });
  await assert.rejects(casos.guardarPlan('a', null, { ...base, nombre: 'FREE', precio_mensual: 0 }), { codigo: 'PLAN_FREE_PROTEGIDO' });
  await assert.rejects(casos.guardarPlan('a', null, { ...base, nombre: 'Free', precio_mensual: 1 }), { codigo: 'PLAN_FREE_PROTEGIDO' });
  assert.equal(auditado, 0);
  await casos.guardarPlan('a', 2, { ...base, precio_mensual: 0, activo: false });
  assert.equal(auditado, 1);
  tx.plan = async () => ({ ...base, nombre: 'FREE', precio_mensual: 0 });
  await casos.guardarPlan('a', 2, { ...base, nombre: 'FREE', precio_mensual: 0, activo: false });
  assert.equal(auditado, 2);
});
