const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearAdminInicial } = require('../scripts/crear-admin-inicial');

test('la creación inicial no reemplaza administradores existentes ni devuelve otra contraseña', async () => {
  const operaciones = [];
  const pool = { connect: async () => ({
    query: async sql => {
      operaciones.push(sql);
      return { rowCount: sql.startsWith('SELECT 1') ? 1 : 0, rows: [] };
    }, release: () => operaciones.push('release'),
  }) };
  await assert.rejects(crearAdminInicial({ pool, hashear: async () => 'hash', correo: 'admin@example.test' }), /Ya existe/);
  assert.ok(operaciones.includes('ROLLBACK'));
  assert.ok(!operaciones.some(sql => sql.startsWith('INSERT') || sql.startsWith('UPDATE')));
  assert.equal(operaciones.at(-1), 'release');
});
