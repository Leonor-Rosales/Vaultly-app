const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { crearAdminRoutes } = require('../src/controllers/adminRoutes');
const { crearRequiereAuth } = require('../src/controllers/middleware/auth');
const { validarPlan, validarAdministrador, protegerAcceso, protegerPlan } = require('../src/domain/administracion');
const plan = { nombre: 'Premium', precio_mensual: 25.5, cuota_storage_gb: 20, limite_descargas: null, permite_carpetas_publicas: true, activo: true };
test('editar administradores no permite saltarse la verificación del correo', async () => {
  const { crearCasosAdministracion } = require('../src/usecases/administracion');
  let guardado = false;
  const casos = crearCasosAdministracion({ repo: { transaccion: async (_tipo, fn) => fn({
    actor: async () => ({ rol: 'ADMIN', estado_cuenta: 'ACTIVO' }),
    administrador: async () => ({ correo_electronico: 'antes@example.test', estado_cuenta: 'ACTIVO' }),
    guardarAdministrador: async () => { guardado = true; },
  }) } });
  await assert.rejects(casos.guardarAdministrador('actor', 'otro', { nombre_completo: 'Ana', correo_electronico: 'nuevo@example.test', activo: true }), /verificar/);
  assert.equal(guardado, false);
});
test('planes validan unidades, ilimitados, decimales y booleanos independientes', () => {
  assert.deepEqual(validarPlan(plan), plan);
  for (const cambio of [{ precio_mensual: -1 }, { precio_mensual: 1.234 }, { precio_mensual: '20' }, { cuota_storage_gb: 0 }, { cuota_storage_gb: 1.5 }, { limite_descargas: -1 }, { activo: 'true' }, { permite_carpetas_publicas: 1 }, { nombre: ' ' }]) assert.throws(() => validarPlan({ ...plan, ...cambio }));
  assert.equal(validarPlan({ ...plan, limite_descargas: 0, permite_carpetas_publicas: false }).limite_descargas, 0);
});
test('cuentas validan correo y contraseña; desactivar usa BLOQUEADO, nunca pendiente de verificación', () => {
  const d = { nombre_completo: ' Ana ', correo_electronico: ' ANA@example.test ', activo: false, password: 'Segura123!' };
  assert.equal(validarAdministrador(d, true).estado_cuenta, 'BLOQUEADO');
  assert.equal(validarAdministrador(d, true).correo_electronico, 'ana@example.test');
  assert.throws(() => validarAdministrador({ ...d, password: '123' }, true));
  assert.throws(() => validarAdministrador({ ...d, correo_electronico: 'mal' }));
});
test('protege último administrador, acceso propio y condiciones de suscripciones', () => {
  assert.throws(() => protegerAcceso('a', 'b', false, 1), /último/);
  assert.throws(() => protegerAcceso('a', 'a', false, 2), /propia/);
  protegerAcceso('a', 'b', false, 2);
  assert.throws(() => protegerPlan(plan, { ...plan, precio_mensual: 99 }, true), /suscripciones/);
  protegerPlan(plan, { ...plan, activo: false }, true);
  assert.throws(() => protegerPlan({ ...plan, nombre: 'Free' }, { ...plan, nombre: 'Free', activo: false }, false), /Free/);
});
test('todos los endpoints rechazan cliente, sesión ausente, token antiguo y cuenta bloqueada', async t => {
  let estado = 'ACTIVO', rol = 'ADMIN', llamadas = 0;
  const auth = crearRequiereAuth(token => { if (token === 'malo') throw Error(); return { sub: 'id', rol: 'ADMIN' }; }, async () => ({ rol, estado_cuenta: estado }));
  const app = express(); app.use(express.json());
  const caso = async () => { llamadas++; return []; };
  app.use('/api/admin', crearAdminRoutes({ listarPlanes: caso, listarAdministradores: caso, guardarPlan: caso, guardarAdministrador: caso }, auth));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/admin`;
  const rutas = [['GET', '/planes'], ['POST', '/planes'], ['PUT', '/planes/1'], ['GET', '/administradores'], ['POST', '/administradores'], ['PUT', '/administradores/00000000-0000-4000-8000-000000000001']];
  for (const [token, role, state, status] of [[null, 'ADMIN', 'ACTIVO', 401], ['malo', 'ADMIN', 'ACTIVO', 401], ['valido', 'CLIENTE', 'ACTIVO', 403], ['valido', 'ADMIN', 'BLOQUEADO', 401]]) {
    rol = role; estado = state;
    for (const [method, path] of rutas) assert.equal((await fetch(url + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} })).status, status);
  }
  assert.equal(llamadas, 0);
  rol = 'ADMIN'; estado = 'ACTIVO';
  assert.equal((await fetch(url + '/planes', { headers: { Authorization: 'Bearer valido' } })).status, 200);
  assert.equal(llamadas, 1);
});
