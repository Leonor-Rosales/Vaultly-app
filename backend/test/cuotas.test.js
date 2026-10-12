const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cicloMensual, vigente, comprobarEspacio, resumen, policy } = require('../src/domain/cuotas');

test('unidad decimal y límites inclusivos de almacenamiento', () => {
  assert.equal(policy.bytesPerGB, 1000000000);
  assert.doesNotThrow(() => comprobarEspacio(70, 10, 20, 100));
  assert.throws(() => comprobarEspacio(70, 10, 21, 100), { codigo: 'CUOTA_ALMACENAMIENTO' });
  assert.throws(() => comprobarEspacio(101, 0, 0, 100), { codigo: 'CUOTA_ALMACENAMIENTO' });
});
test('ciclos calendario UTC: febrero bisiesto y diciembre', () => {
  assert.equal(cicloMensual('2024-02-29T23:59:59Z').fin.toISOString(), '2024-03-01T00:00:00.000Z');
  assert.equal(cicloMensual('2026-12-31T23:59:59Z').fin.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(cicloMensual('2026-10-11T12:00:00Z').inicio.toISOString(), '2026-10-01T00:00:00.000Z');
});
test('vigencia requiere estado y fechas; fin exclusivo', () => {
  const s = { estado: 'ACTIVA', fecha_inicio: '2026-10-01', fecha_fin: '2026-11-01' };
  assert.equal(vigente(s, new Date('2026-10-01')), true);
  assert.equal(vigente(s, new Date('2026-11-01')), false);
  assert.equal(vigente(s, new Date('2026-09-30')), false);
  assert.equal(vigente({ ...s, estado: 'CANCELADA' }, new Date('2026-10-05')), false);
});
test('alertas 80%, 100%, sobrecuota y descargas ilimitadas', () => {
  const plan = { id: 1, nombre: 'Free', cuota_storage_gb: 1, limite_descargas: 10, precio_mensual: 0 };
  for (const [n, esperado] of [[79, null], [80, 'PROXIMIDAD'], [99, 'PROXIMIDAD'], [100, 'LIMITE'], [110, 'LIMITE']]) {
    const r = resumen(plan, { consumidas: n / 10 }, n * 10000000, 0);
    assert.equal(r.alertas.almacenamiento, esperado);
  }
  assert.equal(resumen(plan, { consumidas: 8 }, 0, 0).alertas.descargas, 'PROXIMIDAD');
  assert.equal(resumen(plan, { consumidas: 10 }, 0, 0).alertas.descargas, 'LIMITE');
  const r = resumen({ ...plan, limite_descargas: null }, { consumidas: 999 }, 1100000000, 0);
  assert.equal(r.alertas.descargas, null);
  assert.equal(r.descargas.restantes, null);
  assert.equal(r.almacenamiento.disponibles_bytes, 0);
});
