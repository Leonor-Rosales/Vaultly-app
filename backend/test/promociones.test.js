const { test } = require('node:test');
const assert = require('node:assert/strict');
const { precioContratacion } = require('../src/domain/promociones');
const { validarPlan } = require('../src/domain/administracion');
const { crearCasosAdministracion } = require('../src/usecases/administracion');
const { crearCasosPagos } = require('../src/usecases/pagos');
const plan = { id: 3, version: 1, nombre: 'Max', precio_mensual: 200, cuota_storage_gb: 100, limite_descargas: null, activo: true, permite_carpetas_publicas: true, promocion_precio: 0, promocion_inicio: '2026-11-01T06:00:00Z', promocion_fin: '2026-11-20T06:00:00Z' };

test('precio promocional: inicio inclusivo, fin exclusivo y normal fuera de la ventana', () => {
  for (const [fecha, precio] of [['2026-11-01T05:59:59Z',200],['2026-11-01T06:00:00Z',0],['2026-11-20T05:59:59Z',0],['2026-11-20T06:00:00Z',200]]) assert.equal(precioContratacion(plan, new Date(fecha)).precio, precio);
});
test('promociones rechazan fechas inválidas, incompletas, sin zona y precios inconsistentes', () => {
  assert.equal(validarPlan(plan).promocion_precio, 0);
  for (const cambio of [{ promocion_precio: -1 },{ promocion_precio: '0' },{ promocion_precio: 200 },{ promocion_precio: 1.234 },{ promocion_inicio: '2026-11-02T00:00' },{ promocion_fin: plan.promocion_inicio },{ promocion_fin: null },{ nombre: 'Free', precio_mensual: 0 }]) assert.throws(() => validarPlan({ ...plan, ...cambio }));
});
test('al vencer una oferta se exige reconfirmar el precio incluso sin cambiar versión', async () => {
  let escrito = false;
  const pagos = crearCasosPagos({ repo: { conUsuario: (_id, fn) => fn({ ahora: new Date(plan.promocion_fin), plan: async () => plan, registrarPago: async () => { escrito = true; } }) } });
  for (const precioConfirmado of [undefined, 0, '200']) await assert.rejects(async () => pagos.contratar('u', { planId: 3, versionPlan: 1, metodo: 'tarjeta', precioConfirmado }), { codigo: 'PLAN_DESACTUALIZADO' });
  assert.equal(escrito, false);
});
test('auditoría solo acepta filtros acotados; consultas inválidas no llegan al repositorio', () => {
  const admin = crearCasosAdministracion({ repo: {} });
  for (const filtros of [{ pagina:'0' },{ pagina:'1 OR 1=1' },{ accion:'BORRAR' },{ accion:['PLAN_CREADO'] },{ q:'x'.repeat(101) }]) assert.throws(() => admin.listarAuditoria(filtros), { estado: 400 });
});
