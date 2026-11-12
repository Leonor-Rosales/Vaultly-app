const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearServidorVistasPrevias } = require('../src/workers/servidorVistasPrevias');

const secreto = 'secreto-de-prueba-conversor-32-caracteres';

async function abrir(t, procesarSiguiente) {
  const servidor = crearServidorVistasPrevias({ procesarSiguiente, secreto, registrarError() {} });
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  return (ruta = '/internal/procesar-vista-previa', opciones = {}) => fetch(
    `http://127.0.0.1:${servidor.address().port}${ruta}`,
    { method: 'POST', headers: { Authorization: `Bearer ${secreto}` }, ...opciones },
  );
}

test('conversor HTTP exige secreto y método correctos antes de consultar la cola', async t => {
  let llamadas = 0;
  const pedir = await abrir(t, async () => { llamadas++; });
  assert.equal((await pedir(undefined, { headers: {} })).status, 401);
  assert.equal((await pedir(undefined, { headers: { Authorization: 'Bearer incorrecto' } })).status, 401);
  assert.equal((await pedir(undefined, { method: 'GET' })).status, 405);
  assert.equal((await pedir('/otra-ruta')).status, 404);
  assert.equal((await pedir('/health', { method: 'GET', headers: {} })).status, 200);
  assert.equal(llamadas, 0);
  assert.equal((await pedir()).status, 200);
  assert.equal(llamadas, 1);
});

test('una petición espera su trabajo y rechaza solapamientos; un fallo permite reintentar', async t => {
  let avisar, terminar;
  const inicio = new Promise(resolve => { avisar = resolve; });
  const fin = new Promise(resolve => { terminar = resolve; });
  let llamadas = 0;
  const pedir = await abrir(t, async () => {
    llamadas++;
    if (llamadas === 1) { avisar(); await fin; }
    if (llamadas === 2) throw new Error('Neon no disponible');
  });
  const primera = pedir();
  await inicio;
  try {
    assert.equal((await pedir()).status, 409);
    assert.equal(llamadas, 1);
  } finally { terminar(); }
  assert.equal((await primera).status, 200);
  assert.equal((await pedir()).status, 503);
  assert.equal((await pedir()).status, 200);
  assert.equal(llamadas, 3);
});

test('el servicio no arranca con un secreto ausente o corto', () => {
  for (const secreto of [undefined, '', 'corto']) {
    assert.throws(() => crearServidorVistasPrevias({ secreto }), /al menos 32/);
  }
});
