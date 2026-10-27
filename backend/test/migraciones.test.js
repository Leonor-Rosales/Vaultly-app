const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listarMigraciones } = require('../src/infrastructure/migraciones');

test('secuencia SQL completa y prefijos únicos', () => {
  assert.deepEqual(listarMigraciones().map(m => m.nombre), [
    '01_schema.sql', '02_seeds.sql', '03_planes_cuotas.sql',
    '04_descargas_biblioteca.sql', '05_pagos.sql', '06_biblioteca.sql', '07_contador_descargas.sql',
  ]);
});

test('detecta prefijos duplicados con ambos nombres, incluso con ceros distintos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultly-migraciones-'));
  try {
    fs.writeFileSync(path.join(dir, '06_biblioteca.sql'), '');
    fs.writeFileSync(path.join(dir, '6_reservas.sql'), '');
    assert.throws(() => listarMigraciones(dir), /Prefijo de migración duplicado.*06_biblioteca.sql.*6_reservas.sql/);
  } finally {
    fs.unlinkSync(path.join(dir, '06_biblioteca.sql'));
    fs.unlinkSync(path.join(dir, '6_reservas.sql'));
    fs.rmdirSync(dir);
  }
});
