const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { crearCasosVistasPrevias } = require('../src/usecases/vistasPrevias');

test('PDF y miniatura requieren propietario y conversión lista', async () => {
  let estado = 'PROCESANDO';
  const abiertos = [];
  const casos = crearCasosVistasPrevias({
    archivos: { buscarParaVistaPrevia: async (_id, user) => user === 'dueno'
      ? { nombre_original: 'documento.docx', tipo_mime: 'application/octet-stream' } : null },
    repo: { consultar: async () => ({ estado }) },
    almacenamiento: { abrir: async clave => { abiertos.push(clave); return Readable.from([]); } },
  });
  await assert.rejects(casos.abrir('id', 'otro'), { estado: 404 });
  await assert.rejects(casos.abrir('id', 'dueno'), { estado: 409 });
  assert.deepEqual(abiertos, []);
  estado = 'LISTA';
  assert.equal((await casos.abrir('id', 'dueno')).tipo, 'application/pdf');
  assert.equal((await casos.abrir('id', 'dueno', true)).tipo, 'image/png');
  assert.deepEqual(abiertos, ['vistas-previas/id/documento.pdf', 'vistas-previas/id/miniatura.png']);
});

test('un fallo después de guardar el PDF queda pendiente de reintento', async () => {
  const acciones = [];
  const casos = crearCasosVistasPrevias({
    repo: { trabajar: fn => fn({ id: 'id', archivo_id: 'id', nombre_original: 'a.docx', tipo_mime: '', intentos: 0 }, {
      iniciar: async () => acciones.push('iniciar'),
      completar: async () => acciones.push('completar'),
      fallar: async () => acciones.push('fallar'),
    }) },
    almacenamiento: { guardarDerivado: async clave => {
      acciones.push(clave);
      if (clave.endsWith('.png')) throw new Error('MinIO interrumpido');
    } },
    convertir: async (_a, _f, guardar) => guardar({ pdf: 'pdf', miniatura: 'png' }),
    registrarError() {},
  });
  await casos.procesarSiguiente();
  assert.deepEqual(acciones, ['iniciar', 'vistas-previas/id/documento.pdf', 'vistas-previas/id/miniatura.png', 'fallar']);
});

test('los derivados de un original eliminado se limpian antes de retirar el trabajo', async () => {
  const acciones = [];
  const casos = crearCasosVistasPrevias({
    repo: { trabajar: fn => fn({ id: 'id', archivo_id: null }, { eliminar: async () => acciones.push('registro') }) },
    almacenamiento: { eliminar: async clave => acciones.push(clave) },
  });
  await casos.procesarSiguiente();
  assert.deepEqual(acciones, ['vistas-previas/id/documento.pdf', 'vistas-previas/id/miniatura.png', 'registro']);
});
