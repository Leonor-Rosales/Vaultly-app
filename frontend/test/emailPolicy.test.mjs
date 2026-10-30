import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { errorCorreo } from '../src/services/emailPolicy.ts';
const require = createRequire(import.meta.url);
const { validarSolicitud } = require('../../backend/src/domain/cambioCorreo.js');

test('cliente y servidor aceptan correos válidos y rechazan errores de formato o dominio', () => {
  for (const correo of ['ana@gmail.com', ' Ana+cuenta@Empresa.CO ', 'ana@elvallecolegio.edu.gt', 'a@gmail.co', 'a@gmial.com', 'a..b@example.com', 'a@-dominio.com', 'a@dominio..com', 'a@dominio.c', 'a'.repeat(65)+'@example.com']) {
    let error = '';
    try { validarSolicitud({ correo, password: 'actual' }); } catch (e) { error = e.message; }
    assert.equal(!errorCorreo(correo), !error, correo);
  }
  assert.match(errorCorreo('correo@gmail.co'), /gmail.com/);
  assert.equal(errorCorreo('correo@empresa.co'), '');
});
