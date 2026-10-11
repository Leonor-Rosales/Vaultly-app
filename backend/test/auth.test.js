const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const loadWith = require('./loadWith');
const { validarPassword } = require('../src/domain/passwordPolicy');
const { validarRegistro } = require('../src/domain/validaciones');
const { hashear, comparar } = require('../src/infrastructure/contrasenas');

const invalidas = ['', 'Aa1!aaa', 'AAAAAA1!', 'aaaaaa1!', 'Aaaaaaa!', 'Aaaaaaa1', 'Aaaaaa1 ', 'Aaaaaa1\t', 'Aa1!' + 'a'.repeat(69), 'Aa1!' + 'é'.repeat(35), null, 12345678, {}, []];
for (const [i, password] of invalidas.entries()) {
  test(`política rechaza caso inválido ${i}`, () => {
    assert.throws(() => validarPassword(password), { estado: 400 });
  });
}
for (const password of ['Aa1!aaaa', 'Aa1!' + 'a'.repeat(68), 'Aa1!' + 'é'.repeat(34), 'Áé1!abcd', ' Aa1!aaa ', 'Aa1!😀abc']) {
  test(`política acepta límite válido de ${Buffer.byteLength(password)} bytes`, () => {
    assert.doesNotThrow(() => validarPassword(password));
  });
}
test('confirmación diferente y correos de otros proveedores', () => {
  const datos = { nombre_completo: 'Prueba', correo_electronico: 'prueba@outlook.com', password: 'Aa1!aaaa' };
  assert.doesNotThrow(() => validarRegistro(datos));
  assert.throws(() => validarRegistro({ ...datos, confirmar_password: 'otro' }), /no coinciden/);
});
test('hash conserva espacios y mayúsculas, sin almacenar texto plano', async () => {
  const password = ' Aa1!aaa ';
  const hash = await hashear(password);
  assert.notEqual(hash, password);
  assert.equal(await comparar(password, hash), true);
  assert.equal(await comparar(password.trim(), hash), false);
  assert.equal(await comparar(password.toLowerCase(), hash), false);
});

function authDoubles({ mailFails = false } = {}) {
  const calls = [];
  const hash = async (p) => { calls.push(['hash', p]); return 'hash-de-prueba'; };
  const registro = loadWith(path.resolve(__dirname, '../src/usecases/registrarUsuario.js'), {
    '../infrastructure/usuarioRepositorio': {
      buscarRolPorNombre: async () => { calls.push(['rol']); return { id: 'cliente' }; },
      crearUsuario: async (datos) => { calls.push(['crear', datos]); return { id: 'usuario' }; },
    },
    '../infrastructure/contrasenas': { hashear: hash },
    './enviarVerificacion': { enviarVerificacion: async () => { if (mailFails) throw new Error('SMTP de prueba no disponible'); } },
  });
  const reset = loadWith(path.resolve(__dirname, '../src/usecases/restablecerPassword.js'), {
    '../infrastructure/contrasenas': { hashear: hash },
    '../infrastructure/tokens': { verificarTokenRecuperacion: () => { calls.push(['token']); return { sub: 'usuario' }; } },
    '../infrastructure/db': { query: async (...args) => { calls.push(['query', ...args]); return { rowCount: 1 }; } },
  });
  return { ...registro, ...reset, calls };
}
test('registro y restablecimiento rechazan entradas inválidas antes del hash o persistencia', async () => {
  const { registrarUsuario, restablecerPassword, calls } = authDoubles();
  for (const password of invalidas) {
    await assert.rejects(registrarUsuario({ nombre_completo: 'Prueba', correo_electronico: 'prueba@example.org', password }), { estado: 400 });
    await assert.rejects(restablecerPassword('token-prueba', password), { estado: 400 });
  }
  assert.deepEqual(calls, []);
});
test('registro de 8 caracteres conserva contraseña y comunica fallo de correo sin duplicar usuario', async () => {
  const { registrarUsuario, calls } = authDoubles({ mailFails: true });
  const result = await registrarUsuario({ nombre_completo: 'Prueba', correo_electronico: 'prueba@example.org', password: 'Aa1!aaaa' });
  assert.equal(result.correo_enviado, false);
  assert.match(result.mensaje, /no se pudo enviar/);
  assert.equal(calls.filter(([op]) => op === 'crear').length, 1);
  assert.deepEqual(calls.find(([op]) => op === 'hash'), ['hash', 'Aa1!aaaa']);
  const created = calls.find(([op]) => op === 'crear')[1];
  assert.equal(created.passwordHash, 'hash-de-prueba');
  assert.equal(created.password, undefined);
});
test('registro confirma envío y restablecimiento acepta 8 caracteres sin modificar la entrada', async () => {
  const { registrarUsuario, restablecerPassword, calls } = authDoubles();
  assert.equal((await registrarUsuario({ nombre_completo: 'Prueba', correo_electronico: 'prueba@example.org', password: 'Aa1!aaaa' })).correo_enviado, true);
  await restablecerPassword('token-prueba', ' Aa1!aa ');
  assert.deepEqual(calls.filter(([op]) => op === 'hash').at(-1), ['hash', ' Aa1!aa ']);
  assert.deepEqual(calls.find(([op]) => op === 'query')[2], ['hash-de-prueba', 'usuario']);
});

test('inicio de sesión mantiene contraseñas existentes sin exigir la nueva política', async () => {
  let comparada;
  const { iniciarSesion } = loadWith(path.resolve(__dirname, '../src/usecases/iniciarSesion.js'), {
    '../infrastructure/usuarioRepositorio': { buscarPorCorreoConRol: async () => ({ id: 'usuario', estado_cuenta: 'ACTIVO', password_hash: 'hash-existente', rol: 'CLIENTE' }) },
    '../infrastructure/contrasenas': { comparar: async (password) => { comparada = password; return true; } },
    '../infrastructure/tokens': { crearTokenSesion: () => 'token-de-prueba' },
  });
  assert.equal((await iniciarSesion({ correo_electronico: 'prueba@example.org', password: 'anterior' })).token, 'token-de-prueba');
  assert.equal(comparada, 'anterior');
});
