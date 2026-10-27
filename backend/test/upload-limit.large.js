// Prueba optativa: escribe unos 2 GiB secuencialmente en temporales, sin reservarlos en RAM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const express = require('express');
const { crearArchivosRoutes } = require('../src/controllers/archivosRoutes');
const { ErrorApp } = require('../src/domain/errores');
const { maxFileBytes } = require('../../shared/upload-policy.json');

test('HTTP: 1 GiB exacto, exceso y limpieza tras éxito y rechazo', async t => {
  const directorioTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'vaultly-limit-test-'));
  let recibidos = 0;
  let rechazar = false;
  const app = express();
  app.use('/api/archivos', crearArchivosRoutes({
    subir: async (_usuario, datos) => {
      if (rechazar) throw new ErrorApp('Cuota agotada', 409, 'CUOTA_ALMACENAMIENTO');
      recibidos = 0;
      for await (const chunk of datos.contenido) recibidos += chunk.length;
      assert.equal(recibidos, datos.tamanioBytes);
      return { tamanio_bytes: recibidos };
    },
  }, (req, _res, next) => { req.usuario = { sub: 'test' }; next(); }, { directorioTemporal }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rmdir(directorioTemporal);
  });
  async function enviar(size) {
    const body = Readable.from((async function* () {
      yield Buffer.from('--vaultly-test\r\nContent-Disposition: form-data; name="archivo"; filename="grande.bin"\r\nContent-Type: application/octet-stream\r\n\r\n');
      const chunk = Buffer.alloc(64 * 1024, 97);
      for (let restantes = size; restantes > 0; restantes -= chunk.length) yield chunk.subarray(0, Math.min(restantes, chunk.length));
      yield Buffer.from('\r\n--vaultly-test--\r\n');
    })());
    return fetch(`http://127.0.0.1:${server.address().port}/api/archivos`, {
      method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=vaultly-test' }, body, duplex: 'half',
    });
  }
  async function comprobarLimpieza() {
    for (let i = 0; i < 100 && (await fs.readdir(directorioTemporal)).length; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(await fs.readdir(directorioTemporal), []);
  }
  const aceptado = await enviar(maxFileBytes);
  assert.equal(aceptado.status, 201);
  assert.equal((await aceptado.json()).tamanio_bytes, maxFileBytes);
  await comprobarLimpieza();
  const exceso = await enviar(maxFileBytes + 1);
  assert.equal(exceso.status, 413);
  assert.equal((await exceso.json()).codigo, 'ARCHIVO_DEMASIADO_GRANDE');
  await comprobarLimpieza();
  rechazar = true;
  const cuota = await enviar(1024);
  assert.equal(cuota.status, 409);
  await cuota.json();
  await comprobarLimpieza();
});
