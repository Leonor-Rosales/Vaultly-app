import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptarPago, adaptarPlan } from '../src/services/adaptadoresPlanesPagos.ts';

test('Adapter: planes convierten ID y precio y conservan cero e ilimitadas', () => {
  const origen = Object.freeze({ id: 7, nombre: 'Premium', cuota_storage_gb: 100, precio_mensual: '29.90', limite_descargas: null });
  assert.deepEqual(adaptarPlan(origen), { id: '7', nombre: 'Premium', almacenamientoGb: 100, precio: 29.9, descargasMensuales: null });
  const gratis = adaptarPlan({ ...origen, precio_mensual: '0.00', limite_descargas: 0 });
  assert.equal(gratis.precio, 0);
  assert.equal(gratis.descargasMensuales, 0);
});

test('Adapter: pagos mantienen fecha local, estado e identidad; traducen metodos historicos', () => {
  const origen = Object.freeze({ id: 'p1', fecha: '2026-10-31T02:30:00Z', codigo: 'V-1', plan: 'Premium', monto: 29.9, metodo: 'tarjeta', estado: 'Completado' });
  assert.deepEqual(adaptarPago(origen), { ...origen, fecha: new Date(origen.fecha).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }), metodo: 'Tarjeta simulada' });
  assert.equal(adaptarPago({ ...origen, metodo: 'transferencia' }).metodo, 'Transferencia simulada');
  assert.equal(adaptarPago({ ...origen, metodo: 'legado' }).metodo, 'legado');
  assert.equal(adaptarPago({ ...origen, estado: 'Pendiente' }).estado, 'Pendiente');
});
