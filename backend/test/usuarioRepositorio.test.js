const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const loadWith = require('./loadWith');

const cargar = (query) => loadWith(path.resolve(__dirname, '../src/infrastructure/usuarioRepositorio.js'), { './db': { query } });

test('actualizarPassword enlaza id y hash correctamente y devuelve fila o null', async () => {
  let params;
  const repo = cargar(async (sql, values) => {
    assert.match(sql, /SET password_hash = \$2/);
    assert.match(sql, /WHERE id = \$1/);
    params = values;
    return { rows: [{ id: 'usuario' }] };
  });
  assert.deepEqual(await repo.actualizarPassword('usuario', 'hash'), { id: 'usuario' });
  assert.deepEqual(params, ['usuario', 'hash', null]);
  assert.equal(await cargar(async () => ({ rows: [] })).actualizarPassword('ausente', 'hash'), null);
});

test('el adaptador traduce duplicados PostgreSQL a conflicto de dominio y conserva otros errores', async () => {
  const datos = { id: 'id', rolId: 'rol', nombreCompleto: 'Prueba', correo: 'test@example.org', passwordHash: 'hash', estado: 'INACTIVO' };
  await assert.rejects(cargar(async () => { throw Object.assign(new Error('duplicado'), { code: '23505' }); }).crearUsuario(datos), { estado: 409, message: 'Ese correo ya está registrado' });
  const fallo = new Error('conexión fallida');
  await assert.rejects(cargar(async () => { throw fallo; }).crearUsuario(datos), (error) => error === fallo);
});
