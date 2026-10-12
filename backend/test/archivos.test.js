const { cuotasArchivoDoble } = require('./cuotasArchivoDoble');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { crearCasosArchivos } = require('../src/usecases/archivos');

function fixture() {
  const calls = [];
  const archivo = { id: 'archivo', usuario_id: 'propietario', nombre_objeto_minio: 'propietario/objeto', nombre_original: 'informe.txt', tipo_mime: 'text/plain' };
  const repositorio = {
    listarPorUsuario: async (user) => { calls.push(['listar', user]); return user === archivo.usuario_id ? [archivo] : []; },
    registrar: async (metadata) => { calls.push(['registrar', metadata]); return { id: archivo.id, ...metadata }; },
    buscarPorIdYUsuario: async (id, user) => { calls.push(['buscar', id, user]); return id === archivo.id && user === archivo.usuario_id ? archivo : null; },
    eliminarRegistro: async (id, user) => { calls.push(['borrarRegistro', id, user]); return { id }; },
    actualizarVisibilidad: async (id, user, visible) => { calls.push(['visibilidad', id, user, visible]); return id === archivo.id && user === archivo.usuario_id ? { ...archivo, es_publica: visible } : null; },
  };
  const almacenamiento = {
    guardar: async (datos) => { calls.push(['guardar', datos]); return `bucket/${datos.nombreObjeto}`; },
    abrir: async (name) => { calls.push(['abrir', name]); return Readable.from(['contenido']); },
    eliminar: async (name) => { calls.push(['borrarObjeto', name]); },
  };
  const casos = crearCasosArchivos({ repositorio, almacenamiento, cuotas: cuotasArchivoDoble(repositorio, almacenamiento), registrarError: (...args) => calls.push(['log', ...args]) });
  return { calls, casos, archivo, repositorio, almacenamiento };
}
const upload = { nombreOriginal: '../informe.txt', tipoMime: 'text/plain', tamanioBytes: 4, contenido: Buffer.from('hola') };

test('subida conserva metadatos, contenido, visibilidad y nombre único', async () => {
  const { casos, calls } = fixture();
  const result = await casos.subir('propietario', upload, true);
  assert.equal(result.nombreOriginal, 'informe.txt');
  assert.equal(result.esPublica, true);
  assert.match(result.nombreObjeto, /^propietario\/[\da-f-]{36}$/);
  assert.equal(result.rutaMinio, `bucket/${result.nombreObjeto}`);
  assert.equal(calls[0][1].contenido, upload.contenido);
  assert.deepEqual(calls.map(([op]) => op), ['guardar', 'registrar']);
});
test('archivo ausente o nombre vacío no producen efectos', async () => {
  const { casos, calls } = fixture();
  await assert.rejects(casos.subir('propietario', undefined, false), { estado: 400 });
  await assert.rejects(casos.subir('propietario', { ...upload, nombreOriginal: ' ' }, false), { estado: 400 });
  assert.deepEqual(calls, []);
});
test('fallo de metadatos limpia el objeto exacto', async () => {
  const { casos, calls, repositorio } = fixture();
  repositorio.registrar = async () => { throw new Error('DB falló'); };
  await assert.rejects(casos.subir('propietario', upload, false), /DB falló/);
  assert.equal(calls[1][0], 'borrarObjeto');
  assert.equal(calls[1][1], calls[0][1].nombreObjeto);
});
test('fallo de limpieza conserva el error original y reporta el pendiente', async () => {
  const { casos, calls, repositorio, almacenamiento } = fixture();
  repositorio.registrar = async () => { throw new Error('DB falló'); };
  almacenamiento.eliminar = async () => { throw new Error('MinIO falló'); };
  await assert.rejects(casos.subir('propietario', upload, false), /DB falló/);
  assert.equal(calls.at(-1)[0], 'log');
});
test('fallo de subida no crea metadatos y compensa el nombre reservado', async () => {
  const { casos, calls, almacenamiento } = fixture();
  almacenamiento.guardar = async () => { throw new Error('MinIO falló'); };
  await assert.rejects(casos.subir('propietario', upload, false), /MinIO falló/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'borrarObjeto');
});
for (const operacion of ['descargar', 'eliminar', 'cambiarVisibilidad']) {
  test(`${operacion} rechaza archivo ajeno o inexistente sin tocar objetos`, async () => {
    const { casos, calls } = fixture();
    await assert.rejects(casos[operacion]('archivo', 'intruso', true), { estado: 404 });
    await assert.rejects(casos[operacion]('inexistente', 'propietario', true), { estado: 404 });
    assert.equal(calls.some(([op]) => ['abrir', 'borrarObjeto', 'borrarRegistro'].includes(op)), false);
  });
}
test('lista solo por usuario y descarga devuelve contenido y metadatos', async () => {
  const { casos, archivo } = fixture();
  assert.deepEqual(await casos.listar('intruso'), []);
  assert.deepEqual(await casos.listar('propietario'), [archivo]);
  const { stream, archivo: downloaded } = await casos.descargar('archivo', 'propietario');
  assert.equal(downloaded, archivo);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(chunks.join(''), 'contenido');
});
test('visibilidad solo acepta booleanos y preserva el propietario', async () => {
  const { casos, calls } = fixture();
  for (const value of ['true', 'false', null, 1, undefined]) {
    await assert.rejects(casos.cambiarVisibilidad('archivo', 'propietario', value), { estado: 400 });
  }
  assert.deepEqual(calls, []);
  assert.equal((await casos.cambiarVisibilidad('archivo', 'propietario', true)).es_publica, true);
  assert.equal((await casos.cambiarVisibilidad('archivo', 'propietario', false)).es_publica, false);
});
test('eliminación exitosa borra objeto antes de metadatos', async () => {
  const { casos, calls } = fixture();
  assert.deepEqual(await casos.eliminar('archivo', 'propietario'), { mensaje: 'Archivo eliminado correctamente' });
  assert.deepEqual(calls.map(([op]) => op), ['buscar', 'borrarObjeto', 'borrarRegistro']);
});
test('fallo MinIO no borra metadatos', async () => {
  const { casos, calls, almacenamiento } = fixture();
  almacenamiento.eliminar = async () => { throw new Error('MinIO falló'); };
  await assert.rejects(casos.eliminar('archivo', 'propietario'), /MinIO falló/);
  assert.equal(calls.some(([op]) => op === 'borrarRegistro'), false);
});
test('fallo PostgreSQL después del borrado no se presenta como éxito ni se revierte ficticiamente', async () => {
  const { casos, calls, repositorio } = fixture();
  repositorio.eliminarRegistro = async () => { throw new Error('DB falló'); };
  await assert.rejects(casos.eliminar('archivo', 'propietario'), /DB falló/);
  assert.equal(calls.at(-1)[0], 'borrarObjeto');
  repositorio.eliminarRegistro = async () => null;
  await assert.rejects(casos.eliminar('archivo', 'propietario'), /El objeto se eliminó/);
});
