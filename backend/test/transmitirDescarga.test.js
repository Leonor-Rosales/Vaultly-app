const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { transmitirDescarga } = require('../src/controllers/transmitirDescarga');

function fixture(stream, fallaInicio = false) {
  const counts = { iniciar: 0, cancelar: 0 };
  const res = new Writable({ write(_chunk, _encoding, next) { next(); } });
  res.headersSent = false;
  res.setHeader = () => {};
  res.flushHeaders = () => { res.headersSent = true; };
  const descarga = { archivo: { tipo_mime: 'text/plain', nombre_original: 'archivo.txt' }, stream,
    iniciar: async () => { counts.iniciar++; if (fallaInicio) throw new Error('cuota cambió'); },
    cancelar: async () => { counts.cancelar++; },
  };
  return { counts, res, descarga };
}
test('fallo al leer antes de transmitir devuelve reserva', async () => {
  const f = fixture(new Readable({ read() { this.destroy(new Error('fallo de lectura')); } }));
  await assert.rejects(transmitirDescarga(f.descarga, f.res), /fallo de lectura/);
  assert.deepEqual(f.counts, { iniciar: 0, cancelar: 1 });
  assert.equal(f.res.headersSent, false);
});
test('rechazo al confirmar inicio devuelve reserva sin enviar cabeceras', async () => {
  const f = fixture(Readable.from(['contenido']), true);
  await assert.rejects(transmitirDescarga(f.descarga, f.res), /cuota cambió/);
  assert.deepEqual(f.counts, { iniciar: 1, cancelar: 1 });
  assert.equal(f.res.headersSent, false);
});
test('interrupción después de comenzar conserva el consumo', async () => {
  const stream = Readable.from((async function* () {
    yield Buffer.from('primera parte');
    await new Promise(resolve => setTimeout(resolve, 20));
    throw new Error('transferencia interrumpida');
  })());
  const f = fixture(stream);
  await assert.rejects(transmitirDescarga(f.descarga, f.res), /transferencia interrumpida/);
  assert.deepEqual(f.counts, { iniciar: 1, cancelar: 0 });
  assert.equal(f.res.headersSent, true);
});
test('descarga vacía exitosa también consume una descarga', async () => {
  const f = fixture(Readable.from([]));
  await transmitirDescarga(f.descarga, f.res);
  assert.deepEqual(f.counts, { iniciar: 1, cancelar: 0 });
});
