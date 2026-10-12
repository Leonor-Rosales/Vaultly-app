const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { crearPlanesRoutes } = require('../src/controllers/planesRoutes');
const { crearRequiereAuth } = require('../src/controllers/middleware/auth');
const { ErrorApp } = require('../src/domain/errores');

test('endpoints de planes autenticados: identidad del token, catálogo y errores', async t => {
  const app = express();
  const cuotas = {
    consultar: async id => ({ usuario: id }),
    catalogo: async () => [{ id: 1, nombre: 'Free', limite_descargas: null }],
  };
  app.use('/api/planes', crearPlanesRoutes(cuotas, crearRequiereAuth(token => {
    if (token !== 'test') throw new Error('Inválido');
    return { sub: 'dueño' };
  })));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/planes`;
  const headers = { Authorization: 'Bearer test' };
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base + '/mi-consumo')).status, 401);
  assert.deepEqual(await (await fetch(base + '/mi-consumo?usuarioId=otro', { headers })).json(), { usuario: 'dueño' });
  assert.equal((await (await fetch(base, { headers })).json())[0].limite_descargas, null);
  cuotas.consultar = async () => { throw new ErrorApp('No disponible', 503, 'PLAN_NO_DISPONIBLE'); };
  const error = await fetch(base + '/mi-consumo', { headers });
  assert.equal(error.status, 503);
  assert.deepEqual(await error.json(), { error: 'No disponible', codigo: 'PLAN_NO_DISPONIBLE' });
});
