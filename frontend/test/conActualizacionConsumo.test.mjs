import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conActualizacionConsumo } from '../src/services/conActualizacionConsumo.ts';

test('Decorator conserva argumentos y resultado y espera el refresco posterior', async () => {
  const eventos = [];
  const archivo = { id: 'archivo' };
  let terminarRefresco;
  const espera = new Promise(resolve => { terminarRefresco = resolve; });
  const decorada = conActualizacionConsumo(async (...args) => {
    assert.deepEqual(args, ['documento', true, ['clase']]);
    eventos.push('operacion');
    return archivo;
  }, async () => { eventos.push('refresco'); await espera; });
  let completada = false;
  const resultado = decorada('documento', true, ['clase']).then(valor => { completada = true; return valor; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(eventos, ['operacion', 'refresco']);
  assert.equal(completada, false);
  terminarRefresco();
  assert.equal(await resultado, archivo);
});

test('Decorator refresca una vez tras un error y conserva el error original aunque falle el refresco', async () => {
  const errorOriginal = new Error('Cuota excedida');
  let refrescos = 0;
  const decorada = conActualizacionConsumo(async () => { throw errorOriginal; }, async () => {
    refrescos++;
    throw new Error('Sin conexión');
  });
  await assert.rejects(decorada(), error => error === errorOriginal);
  assert.equal(refrescos, 1);
});

test('Decorator no convierte un éxito en fallo si el refresco falla', async () => {
  const decorada = conActualizacionConsumo(async () => 'guardado', async () => { throw new Error('Sin conexión'); });
  assert.equal(await decorada(), 'guardado');
});

test('Decorator conserva el resultado void de eliminar y descargar', async () => {
  let refrescos = 0;
  const decorada = conActualizacionConsumo(async () => {}, async () => { refrescos++; });
  assert.equal(await decorada(), undefined);
  assert.equal(refrescos, 1);
});
