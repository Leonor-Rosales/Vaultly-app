const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { crearTareasMantenimiento } = require('../src/infrastructure/mantenimiento');

test('importar la API para Vercel no escucha puertos, programa tareas ni consulta PostgreSQL', () => {
  const resultado = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    process.env.JWT_SECRET = 'secreto-exclusivo-prueba-arranque';
    process.env.MINIO_ROOT_USER = 'prueba';
    process.env.MINIO_ROOT_PASSWORD = 'prueba-arranque';
    process.env.MAIL_USER = 'prueba@example.test';
    const prohibido = () => { throw new Error('Efecto secundario al importar la API'); };
    global.setInterval = prohibido;
    require('node:http').Server.prototype.listen = prohibido;
    const { Pool } = require('pg');
    Pool.prototype.query = prohibido;
    Pool.prototype.connect = prohibido;
    const app = require('./src/server');
    assert.equal(typeof app, 'function');
    assert.equal(typeof app.handle, 'function');
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.ifError(resultado.error);
  assert.equal(resultado.status, 0, resultado.stderr || resultado.stdout);
});

test('el mantenimiento evita solapamientos y puede reintentarse después de un fallo', async () => {
  let resolver;
  let llamadas = 0;
  const errores = [];
  const tareas = crearTareasMantenimiento({
    cuotas: { recuperarReservas: async () => {
      llamadas++;
      if (llamadas === 1) await new Promise(resolve => { resolver = resolve; });
      if (llamadas === 2) throw new Error('Base temporalmente no disponible');
      return { fallos: 0 };
    } },
    registrarError: (...datos) => errores.push(datos),
  });
  const primera = tareas.recuperarReservas();
  await tareas.recuperarReservas();
  assert.equal(llamadas, 1);
  resolver();
  await primera;
  await tareas.recuperarReservas();
  assert.equal(errores.length, 1);
  assert.deepEqual(await tareas.recuperarReservas(), { fallos: 0 });
  assert.equal(llamadas, 3);
});
