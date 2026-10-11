import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { evaluarPassword, errorPassword, emailValido } from '../src/services/passwordPolicy.ts';
const require = createRequire(import.meta.url);
const { validarPassword } = require('../../backend/src/domain/passwordPolicy.js');

test('Baja depende de todos los requisitos, Media de 8 a 11 y Alta desde 12', () => {
  for (const password of ['', 'a'.repeat(20), 'AAAAAA1!', 'aaaaaa1!', 'Aaaaaaa!', 'Aaaaaaa1', 'Aaaaaa1 ', 'Aa1!aaa', 'Aa1!' + 'a'.repeat(69)]) {
    assert.equal(evaluarPassword(password).nivel, 'Baja');
    assert.notEqual(errorPassword(password, password), '');
  }
  for (const length of [8, 9, 10, 11]) assert.equal(evaluarPassword('Aa1!' + 'a'.repeat(length - 4)).nivel, 'Media');
  for (const length of [12, 72]) assert.equal(evaluarPassword('Aa1!' + 'a'.repeat(length - 4)).nivel, 'Alta');
});
test('confirmación distinta, vacía e igual', () => {
  assert.equal(errorPassword('Aa1!aaaa', 'otra'), 'Las contraseñas no coinciden');
  assert.equal(errorPassword('Aa1!aaaa', ''), 'Las contraseñas no coinciden');
  assert.equal(errorPassword('Aa1!aaaa', 'Aa1!aaaa'), '');
});

test('el exceso de bytes usa el error existente sin añadir requisitos visibles', () => {
  for (const password of ['Aa1!' + 'a'.repeat(69), 'Aa1!' + 'é'.repeat(35), 'Aa1!' + '😀'.repeat(18)]) {
    assert.equal(errorPassword(password, password), 'La contraseña es demasiado larga. Usa una más corta.');
    assert.equal(evaluarPassword(password).valida, false);
    assert.equal(evaluarPassword(password).nivel, 'Baja');
    assert.equal(evaluarPassword(password).requisitos.some(({ id }) => id === 'bytes'), false);
  }
  assert.equal(errorPassword('Aa1!' + 'é'.repeat(34), 'Aa1!' + 'é'.repeat(34)), '');
});
test('frontend y backend coinciden en límites UTF-8, Unicode, espacios y combinaciones', () => {
  const passwords = ['Áé1!abcd', ' Aa1!aa ', 'Aa1!' + 'é'.repeat(34), 'Aa1!' + 'é'.repeat(35), 'Aa1!😀abc', 'Aa1!😀ab'];
  for (const prefix of ['Aa1!', 'AA1!', 'aa1!', 'Aaa!', 'Aaa1', 'Aa1 ', 'Aa1\n']) {
    for (let n = 0; n < 75; n++) passwords.push(prefix + 'a'.repeat(n));
  }
  for (const password of passwords) {
    let backendValida = true;
    try { validarPassword(password); } catch { backendValida = false; }
    assert.equal(evaluarPassword(password).valida, backendValida);
  }
  assert.equal(evaluarPassword('Aa1!' + 'é'.repeat(34)).valida, true);
  assert.equal(evaluarPassword('Aa1!' + 'é'.repeat(35)).valida, false);
});
test('correo válido de cualquier proveedor', () => {
  for (const email of ['a@outlook.com', 'a@example.org', 'a@gmail.com']) assert.equal(emailValido(email), true);
  for (const email of ['a', 'a@', 'a b@example.org']) assert.equal(emailValido(email), false);
});
