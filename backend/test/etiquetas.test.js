const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarEtiquetas } = require('../src/domain/etiquetas');
const { crearCasosArchivos } = require('../src/usecases/archivos');

test('normalización NFC, espacios, acentos y duplicados antes del máximo', () => {
  assert.deepEqual(normalizarEtiquetas([' Matemáticas ', 'matema\u0301ticas', 'BASES   DE DATOS', 'año', 'ano', '2026']), ['matemáticas', 'bases de datos', 'año', 'ano', '2026']);
  assert.equal(normalizarEtiquetas(['😀'.repeat(30)])[0].length, 60);
  assert.equal(normalizarEtiquetas(['e\u0301'.repeat(30)])[0].length, 30);
  assert.deepEqual(normalizarEtiquetas([]), []);
});
for (const entrada of [null, {}, 12, 'texto', [12], [{}], [null], [''], ['   '], ['a\nb'], ['a\tb'], ['a\u0085b'], ['a'.repeat(31)], ['😀'.repeat(31)], ['a','b','c','d','e','f']]) {
  test(`entrada inválida: ${JSON.stringify(entrada)}`, () => {
    assert.throws(() => normalizarEtiquetas(entrada), {estado: 400});
  });
}
test('edición valida, autoriza por repositorio y no accede a cuotas ni MinIO', async () => {
  const llamadas = [];
  const casos = crearCasosArchivos({ repositorio: { reemplazarEtiquetas: async (...args) => {
    llamadas.push(args); return args[1] === 'autor' ? {id: 'id', etiquetas: args[2]} : null;
  } } });
  assert.deepEqual(await casos.editarEtiquetas('id','autor',[' HOLA ']), {id:'id', etiquetas:['hola']});
  assert.deepEqual(await casos.editarEtiquetas('id','autor',[]), {id:'id', etiquetas:[]});
  await assert.rejects(casos.editarEtiquetas('id','otro',[]), {estado:404});
  await assert.rejects(casos.editarEtiquetas('id','autor',[8]), {estado:400});
  assert.equal(llamadas.length, 3);
});
test('subida inválida no reserva cuota ni toca almacenamiento', async () => {
  const casos = crearCasosArchivos({});
  await assert.rejects(casos.subir('autor', {}, false, ['']), {estado:400});
});
