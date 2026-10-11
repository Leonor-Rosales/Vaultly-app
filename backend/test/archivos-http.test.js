const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
const express = require('express');
const loadWith = require('./loadWith');
const { crearCasosArchivos } = require('../src/usecases/archivos');

test('HTTP conserva autenticación, endpoints, respuestas, multipart y descarga privada', async (t) => {
  const middleware = loadWith(path.resolve(__dirname, '../src/controllers/middleware/auth.js'), {
    '../../infrastructure/tokens': { verificarTokenSesion: (token) => {
      if (!['propietario', 'intruso'].includes(token)) throw new Error('token inválido');
      return { sub: token };
    } },
  });
  const { crearArchivosRoutes } = loadWith(path.resolve(__dirname, '../src/controllers/archivosRoutes.js'), {
    './middleware/auth': middleware,
  });
  let metadata;
  let bytes;
  let failRead = false;
  const casos = crearCasosArchivos({
    repositorio: {
      registrar: async (datos) => {
        metadata = { id: 'id', nombre_original: datos.nombreOriginal, tipo_mime: datos.tipoMime, nombre_objeto_minio: datos.nombreObjeto, usuario_id: datos.usuarioId, es_publica: datos.esPublica };
        return metadata;
      },
      listarPorUsuario: async (user) => user === metadata?.usuario_id ? [metadata] : [],
      buscarPorIdYUsuario: async (id, user) => id === metadata?.id && user === metadata.usuario_id ? metadata : null,
      actualizarVisibilidad: async (id, user, visible) => {
        if (id !== metadata?.id || user !== metadata.usuario_id) return null;
        metadata.es_publica = visible;
        return metadata;
      },
      eliminarRegistro: async () => { metadata = undefined; return { id: 'id' }; },
    },
    almacenamiento: {
      guardar: async ({ contenido }) => { bytes = contenido; return 'bucket/objeto'; },
      abrir: async () => failRead ? new Readable({ read() { this.destroy(new Error('lectura fallida de prueba')); } }) : Readable.from([bytes]),
      eliminar: async () => { bytes = undefined; },
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/archivos', crearArchivosRoutes(casos));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/archivos`;
  const request = (suffix = '', options = {}, user = 'propietario') => fetch(base + suffix, { ...options, headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}), ...options.headers } });
  for (const [method, suffix] of [['GET', ''], ['POST', ''], ['GET', '/id/descargar'], ['DELETE', '/id'], ['PATCH', '/id/visibilidad']]) {
    assert.equal((await request(suffix, { method }, '')).status, 401);
  }
  assert.equal((await request('', {}, 'token-inválido')).status, 401);
  const missing = await request('', { method: 'POST' });
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { error: 'Debes seleccionar un archivo' });
  const form = new FormData();
  form.append('archivo', new Blob(['hola'], { type: 'text/plain' }), 'informe.txt');
  form.append('es_publica', 'true');
  const uploaded = await request('', { method: 'POST', body: form });
  assert.equal(uploaded.status, 201);
  assert.equal((await uploaded.json()).es_publica, true);
  assert.equal((await (await request()).json()).length, 1);
  assert.deepEqual(await (await request('', {}, 'intruso')).json(), []);
  for (const [method, suffix] of [['GET', '/id/descargar'], ['DELETE', '/id'], ['PATCH', '/id/visibilidad']]) {
    const denied = await request(suffix, { method, ...(method === 'PATCH' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ es_publica: false }) } : {}) }, 'intruso');
    assert.equal(denied.status, 404);
    assert.deepEqual(await denied.json(), { error: 'Archivo no encontrado' });
  }
  const downloaded = await request('/id/descargar');
  assert.equal(downloaded.headers.get('content-type'), 'text/plain');
  assert.equal(downloaded.headers.get('content-disposition'), "attachment; filename*=UTF-8''informe.txt");
  assert.equal(await downloaded.text(), 'hola');
  for (const [value, status] of [['true', 400], [false, 200]]) {
    assert.equal((await request('/id/visibilidad', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ es_publica: value }) })).status, status);
  }
  failRead = true;
  assert.equal((await request('/id/descargar')).status, 500);
  const deleted = await request('/id', { method: 'DELETE' });
  assert.deepEqual(await deleted.json(), { mensaje: 'Archivo eliminado correctamente' });
  assert.equal(bytes, undefined);
  assert.equal((await request('/id/descargar')).status, 404);
});
