const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const express = require('express');
const { crearArchivosRoutes } = require('../src/controllers/archivosRoutes');
const { crearCasosArchivos } = require('../src/usecases/archivos');
const { crearCasosVistasPrevias } = require('../src/usecases/vistasPrevias');

test('Biblioteca: vistas públicas gratuitas y privadas protegidas, incluido PDF convertido', async t => {
  let publica = true;
  let reintentos = 0;
  const archivo = id => ({ id, usuario_id: 'dueno', es_publica: publica, nombre_original: id === 'office' ? 'doc.docx' : 'notas.txt',
    tipo_mime: id === 'office' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain',
    nombre_objeto_minio: 'original', tamanio_bytes: 10 });
  const archivos = {
    buscarParaVistaPrevia: async (id, user) => user === 'dueno' || publica ? archivo(id) : null,
    buscarPorIdYUsuario: async (id, user) => user === 'dueno' ? archivo(id) : null,
  };
  const almacenamiento = { abrir: async () => Readable.from(['contenido']) };
  const vistasPrevias = crearCasosVistasPrevias({
    archivos, almacenamiento, repo: { consultar: async () => ({ estado: 'LISTA' }), reintentar: async () => reintentos++ },
  });
  const casos = crearCasosArchivos({ repositorio: archivos, almacenamiento, vistasPrevias,
    cuotas: new Proxy({}, { get() { throw new Error('La vista previa no debe tocar cuotas'); } }) });
  const app = express();
  app.use(crearArchivosRoutes(casos, (req, res, next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.usuario = { sub: req.headers.authorization }; next();
  }, vistasPrevias));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const pedir = (ruta, usuario = 'visitante', method = 'GET') =>
    fetch('http://127.0.0.1:' + server.address().port + ruta, { method, headers: { authorization: usuario } });
  for (const ruta of ['/texto/vista-previa', '/office/vista-previa', '/office/miniatura', '/office/estado-vista-previa']) {
    assert.equal((await pedir(ruta, '')).status, 401);
    assert.equal((await pedir(ruta)).status, 200);
  }
  assert.equal((await pedir('/office/vista-previa')).headers.get('content-type'), 'application/pdf');
  assert.equal((await pedir('/office/reintentar-vista-previa', 'visitante', 'POST')).status, 404);
  assert.equal(reintentos, 0);
  publica = false;
  for (const ruta of ['/texto/vista-previa', '/office/vista-previa', '/office/miniatura', '/office/estado-vista-previa']) {
    assert.equal((await pedir(ruta)).status, 404);
    assert.equal((await pedir(ruta, 'dueno')).status, 200);
  }
});
