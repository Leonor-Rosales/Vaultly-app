const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCasosPagos } = require('../src/usecases/pagos');

test('contratación conserva cliente, beneficios y vigencia aunque cambien perfil y catálogo', async () => {
  const cliente = { nombre_completo: 'Ana original', correo_electronico: 'original@example.test' };
  const plan = { id: 2, nombre: 'Pro', precio_mensual: 49, cuota_storage_gb: 50, limite_descargas: null };
  const pagos = [];
  const ahora = new Date('2026-11-11T18:00:00Z');
  let suscripcion;
  const tx = {
    cliente, ahora, plan: async () => plan, activa: async () => null, usados: async () => 0, reservados: async () => 0,
    crearSuscripcion: async (_id, inicio, fin) => { suscripcion = { inicio, fin }; },
    registrarPago: async p => { const fila = { ...p, creado_en: p.fecha, plan_nombre: p.planNombre }; pagos.push(fila); return fila; },
    listarPagos: async () => pagos,
  };
  const casos = crearCasosPagos({ repo: { conUsuario: (_id, fn) => fn(tx) } });
  const compra = await casos.contratar('cliente', { planId: 2, metodo: 'tarjeta', comprobante: { moneda: 'USD' } });
  assert.equal(compra.comprobante.moneda, 'GTQ');
  assert.equal(compra.comprobante.inicio, suscripcion.inicio.toISOString());
  assert.equal(compra.comprobante.fin, suscripcion.fin.toISOString());
  cliente.nombre_completo = 'Nombre nuevo'; cliente.correo_electronico = 'nuevo@example.test';
  plan.nombre = 'Otro'; plan.cuota_storage_gb = 1; plan.limite_descargas = 0;
  const [historico] = await casos.historial('cliente');
  assert.deepEqual(historico, compra);
  assert.deepEqual(historico.comprobante.cliente, { nombre: 'Ana original', correo: 'original@example.test' });
  assert.equal(historico.comprobante.almacenamientoGb, 50);
  assert.equal(historico.comprobante.descargasMensuales, null);
  assert.equal(historico.plan, 'Pro');
});

test('pagos antiguos conservan los datos disponibles y no inventan datos históricos', async () => {
  const fila = { id: 'viejo', creado_en: '2026-10-01', codigo: 'VIEJO', plan_nombre: 'Plan antiguo', monto: '15', metodo: 'TRANSFERENCIA', estado: 'COMPLETADO' };
  const casos = crearCasosPagos({ repo: { conUsuario: (_id, fn) => fn({ listarPagos: async () => [fila] }) } });
  const [pago] = await casos.historial('cliente');
  assert.equal(pago.comprobante, null);
  assert.equal(pago.monto, 15);
  assert.equal(pago.plan, 'Plan antiguo');
});
