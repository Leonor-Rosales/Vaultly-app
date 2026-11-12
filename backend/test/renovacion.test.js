const test = require('node:test');
const assert = require('node:assert/strict');
const { crearCasosCuotas } = require('../src/usecases/cuotas');
const { debeRenovar, sumarMes } = require('../src/domain/renovacion');

const AHORA = new Date('2026-12-05T15:00:00Z');
const PRO = { id: 3, nombre: 'Pro Developer', cuota_storage_gb: 50, limite_descargas: null, precio_mensual: '150.00' };
const FREE = { id: 1, nombre: 'Free', cuota_storage_gb: 5, limite_descargas: 2, precio_mensual: '0.00' };

// Repositorio en memoria: solo lo que usa consultar() -> contexto().
function crearRepo({ suscripcion, planes = [FREE, PRO] }) {
  const estado = { suscripcion, cerradas: [], creadas: [], pagos: [] };
  const tx = {
    ahora: AHORA,
    cliente: { nombre_completo: 'Ana López', correo_electronico: 'ana@example.test' },
    activa: async () => estado.suscripcion,
    planActivo: async (id) => planes.find(p => p.id === id) || null,
    free: async () => FREE,
    cerrarSuscripcion: async (id, nuevo) => { estado.cerradas.push([id, nuevo]); estado.suscripcion = null; },
    crearSuscripcion: async (planId, inicio, fin, renovar = false) => {
      const plan = planes.find(p => p.id === planId);
      estado.suscripcion = { id: 'nueva', plan_id: planId, fecha_inicio: inicio, fecha_fin: fin, estado: 'ACTIVA', renovacion_automatica: renovar,
        nombre: plan.nombre, cuota_storage_gb: plan.cuota_storage_gb, limite_descargas: plan.limite_descargas, precio_mensual: plan.precio_mensual };
      estado.creadas.push(estado.suscripcion);
      return estado.suscripcion;
    },
    crearFree: async (planId, inicio, fin) => {
      estado.suscripcion = { id: 'free', plan_id: planId, fecha_inicio: inicio, fecha_fin: fin, estado: 'ACTIVA', renovacion_automatica: false };
      return estado.suscripcion;
    },
    registrarPago: async (p) => { estado.pagos.push(p); return p; },
    ciclo: async (inicio, fin) => ({ inicio, fin, consumidas: 0 }),
    usados: async () => 0,
    reservados: async () => 0,
  };
  return { estado, repo: { conUsuario: (_id, fn) => fn(tx), listarPlanes: async () => planes } };
}

// Igual que tx.activa() en la base: columnas de la suscripción más nombre, cuota y precio del plan.
const vencidaPro = (extra = {}) => ({
  nombre: PRO.nombre, cuota_storage_gb: PRO.cuota_storage_gb, limite_descargas: PRO.limite_descargas, precio_mensual: PRO.precio_mensual,
  id: 's1', plan_id: 3, estado: 'ACTIVA', renovacion_automatica: true,
  fecha_inicio: new Date('2026-11-04T15:00:00Z'), fecha_fin: new Date('2026-12-04T15:00:00Z'), ...extra,
});

test('debeRenovar: solo si venció, el usuario lo pidió y el plan sigue a la venta', () => {
  assert.equal(debeRenovar(vencidaPro(), PRO, AHORA), true);
  assert.equal(debeRenovar(vencidaPro({ renovacion_automatica: false }), PRO, AHORA), false);
  assert.equal(debeRenovar(vencidaPro({ fecha_fin: new Date('2026-12-10T00:00:00Z') }), PRO, AHORA), false);
  assert.equal(debeRenovar(vencidaPro(), null, AHORA), false);
  assert.equal(debeRenovar(vencidaPro(), FREE, AHORA), false);
});

test('vencida con renovación: crea otro mes del mismo plan y registra un pago simulado', async () => {
  const { estado, repo } = crearRepo({ suscripcion: vencidaPro() });
  const casos = crearCasosCuotas({ repo, almacenamiento: {} });
  const r = await casos.consultar('u1');
  assert.equal(r.plan.nombre, 'Pro Developer');
  assert.equal(r.suscripcion.renovacion_automatica, true);
  assert.deepEqual(estado.cerradas, [['s1', 'VENCIDA']]);
  assert.equal(estado.pagos.length, 1);
  assert.equal(estado.pagos[0].monto, 150);
  assert.equal(estado.pagos[0].metodo, 'TARJETA');
  assert.equal(estado.pagos[0].estado, 'COMPLETADO');
  assert.equal(estado.pagos[0].comprobante.cliente.nombre, 'Ana López');
  assert.equal(estado.pagos[0].comprobante.descargasMensuales, null);
  assert.equal(estado.pagos[0].comprobante.inicio, AHORA.toISOString());
  assert.equal(estado.pagos[0].comprobante.fin, sumarMes(AHORA).toISOString());
  assert.match(estado.pagos[0].codigo, /^VLT-[0-9A-F]{10}$/);
  assert.equal(+new Date(r.suscripcion.fecha_fin), +sumarMes(AHORA));
  // Una segunda consulta ya no vuelve a cobrar.
  await casos.consultar('u1');
  assert.equal(estado.pagos.length, 1);
});

test('vencida sin renovación: vuelve a Free y no se cobra nada', async () => {
  const { estado, repo } = crearRepo({ suscripcion: vencidaPro({ renovacion_automatica: false }) });
  const r = await crearCasosCuotas({ repo, almacenamiento: {} }).consultar('u1');
  assert.equal(r.plan.nombre, 'Free');
  assert.equal(r.suscripcion, null);
  assert.equal(estado.pagos.length, 0);
});

test('vencida con renovación pero plan retirado de la venta: vuelve a Free', async () => {
  const { estado, repo } = crearRepo({ suscripcion: vencidaPro(), planes: [FREE] });
  const r = await crearCasosCuotas({ repo, almacenamiento: {} }).consultar('u1');
  assert.equal(r.plan.nombre, 'Free');
  assert.equal(estado.pagos.length, 0);
});

test('suscripción vigente: expone vencimiento y estado de renovación', async () => {
  const vigente = vencidaPro({ fecha_fin: new Date('2026-12-20T00:00:00Z'), renovacion_automatica: false });
  const { estado, repo } = crearRepo({ suscripcion: vigente });
  const r = await crearCasosCuotas({ repo, almacenamiento: {} }).consultar('u1');
  assert.equal(r.suscripcion.renovacion_automatica, false);
  assert.equal(+new Date(r.suscripcion.fecha_fin), +new Date('2026-12-20T00:00:00Z'));
  assert.equal(estado.pagos.length, 0);
});

test('un plan retirado conserva el acceso y avisa antes del vencimiento', async () => {
  const vigente = vencidaPro({ fecha_fin: new Date('2026-12-20T00:00:00Z'), plan_disponible: false });
  const { estado, repo } = crearRepo({ suscripcion: vigente });
  const consumo = await crearCasosCuotas({ repo, almacenamiento: {} }).consultar('u1');
  assert.equal(consumo.plan.id, vigente.plan_id);
  assert.equal(consumo.suscripcion.plan_retirado, true);
  assert.equal(estado.pagos.length, 0);
});
