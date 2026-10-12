import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatoBytes, mensajesAlertas, avisosNuevos } from '../src/services/usagePolicy.ts';
test('unidades decimales coherentes con la cuota de GB', () => {
  assert.equal(formatoBytes(1000000000), '1.00 GB');
  assert.equal(formatoBytes(1000000), '1.0 MB');
});
test('no repite avisos por render/consulta; distingue usuario, ciclo, recurso y gravedad', () => {
  const vistos = new Set();
  const inicial = { almacenamiento: 'PROXIMIDAD', descargas: null };
  assert.equal(avisosNuevos(inicial, 'a', 'octubre', vistos).length, 1);
  assert.equal(avisosNuevos(inicial, 'a', 'octubre', vistos).length, 0);
  assert.equal(avisosNuevos({ almacenamiento: 'LIMITE', descargas: 'PROXIMIDAD' }, 'a', 'octubre', vistos).length, 2);
  assert.equal(avisosNuevos(inicial, 'b', 'octubre', vistos).length, 1);
  assert.equal(avisosNuevos(inicial, 'a', 'noviembre', vistos).length, 1);
});
test('alertas separadas por recurso y nivel, sin aviso ilimitado', () => {
  assert.deepEqual(mensajesAlertas({ almacenamiento: null, descargas: null }), []);
  const r = mensajesAlertas({ almacenamiento: 'PROXIMIDAD', descargas: 'LIMITE' });
  assert.equal(r.length, 2);
  assert.equal(r[0].tipo, 'almacenamiento');
  assert.equal(r[1].tipo, 'descargas');
  assert.match(r[0].mensaje, /poco espacio/);
  assert.match(r[1].mensaje, /límite de descargas/);
});
