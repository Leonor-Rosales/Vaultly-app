const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { crearCasosAuth } = require('../src/usecases/auth');
const { crearAuthController } = require('../src/controllers/authController');
const { crearAuthRoutes } = require('../src/controllers/authRoutes');
const { crearRequiereAuth } = require('../src/controllers/middleware/auth');
const { ErrorApp } = require('../src/domain/errores');

function fixture() {
  const calls = [];
  const usuario = { id: 'usuario', nombre_completo: 'Prueba', correo_electronico: 'test@example.org', estado_cuenta: 'ACTIVO', rol: 'CLIENTE', password_hash: 'hash' };
  const repo = {
    buscarRolPorNombre: async () => ({ id: 'rol' }),
    crearUsuario: async (datos) => { calls.push(['crear', datos]); return usuario; },
    buscarPorCorreoConRol: async (correo) => { calls.push(['buscar', correo]); return usuario; },
    buscarPorIdConRol: async () => ({ id: usuario.id, rol: usuario.rol }),
    activarSiPendiente: async (...args) => { calls.push(['activar', ...args]); return true; },
    obtenerEstado: async () => 'ACTIVO',
    buscarPendientePorCorreo: async (...args) => { calls.push(['pendiente', ...args]); return usuario; },
    actualizarPassword: async (...args) => { calls.push(['actualizar', ...args]); return { id: usuario.id }; },
  };
  const contrasenas = {
    hashear: async (p) => { calls.push(['hash', p]); return 'hash-nuevo'; },
    comparar: async () => true,
  };
  const tokens = {
    crearTokenSesion: () => 'sesion',
    crearTokenVerificacion: () => 'verificar+/=',
    crearTokenRecuperacion: () => 'recuperar+/=',
    verificarTokenVerificacion: () => ({ sub: usuario.id }),
    verificarTokenRecuperacion: () => ({ sub: usuario.id }),
  };
  const correo = {
    enviarCorreoVerificacion: async (datos) => calls.push(['verificacion', datos]),
    enviarCorreoRecuperacion: async (datos) => calls.push(['recuperacion', datos]),
  };
  const casos = () => crearCasosAuth({ repo, contrasenas, tokens, correo, frontendUrl: 'http://localhost:5173', backendUrl: 'http://localhost:3000' });
  return { repo, contrasenas, tokens, correo, usuario, calls, casos };
}

test('registro compone enlace de verificación y asigna CLIENTE inactivo', async () => {
  const f = fixture();
  const result = await f.casos().registrarUsuario({ nombre_completo: ' Prueba ', correo_electronico: 'TEST@example.org', password: 'Aa1!aaaa', rol: 'ADMIN' });
  assert.equal(result.correo_enviado, true);
  const datos = f.calls.find(([op]) => op === 'crear')[1];
  assert.equal(datos.rolId, 'rol');
  assert.equal(datos.estado, 'INACTIVO');
  assert.equal(datos.correo, 'test@example.org');
  assert.equal(datos.passwordHash, 'hash-nuevo');
  assert.equal(f.calls.find(([op]) => op === 'verificacion')[1].enlace, 'http://localhost:3000/api/auth/verificar?token=verificar%2B%2F%3D');
});

test('registro propaga conflicto y no envía correo si falla persistencia', async () => {
  const f = fixture();
  f.repo.crearUsuario = async () => { throw new ErrorApp('Ese correo ya está registrado', 409); };
  await assert.rejects(f.casos().registrarUsuario({ nombre_completo: 'Prueba', correo_electronico: 'test@example.org', password: 'Aa1!aaaa' }), { estado: 409 });
  assert.equal(f.calls.some(([op]) => op === 'verificacion'), false);
});

test('login conserva respuestas para correo inexistente, contraseña errónea y estados de cuenta', async () => {
  const f = fixture();
  const datos = { correo_electronico: 'test@example.org', password: 'anterior' };
  f.repo.buscarPorCorreoConRol = async () => null;
  await assert.rejects(f.casos().iniciarSesion(datos), { estado: 404, codigo: 'USUARIO_NO_REGISTRADO' });
  f.repo.buscarPorCorreoConRol = async () => f.usuario;
  f.contrasenas.comparar = async () => false;
  await assert.rejects(f.casos().iniciarSesion(datos), { estado: 401 });
  f.contrasenas.comparar = async () => true;
  f.usuario.estado_cuenta = 'INACTIVO';
  await assert.rejects(f.casos().iniciarSesion(datos), { estado: 403, codigo: 'CORREO_NO_CONFIRMADO' });
  f.usuario.estado_cuenta = 'BLOQUEADO';
  await assert.rejects(f.casos().iniciarSesion(datos), { estado: 403 });
  f.usuario.estado_cuenta = 'ACTIVO';
  const result = await f.casos().iniciarSesion(datos);
  assert.equal(result.token, 'sesion');
  assert.equal(result.usuario.password_hash, undefined);
});

test('verificación: inválido, activar, ya activa y no verificable', async () => {
  const f = fixture();
  assert.equal(await f.casos().verificarCorreo('token'), 'verificado');
  assert.deepEqual(f.calls[0], ['activar', 'usuario', 'ACTIVO', 'INACTIVO']);
  f.repo.activarSiPendiente = async () => false;
  assert.equal(await f.casos().verificarCorreo('token'), 'verificado');
  for (const estado of ['BLOQUEADO', null]) {
    f.repo.obtenerEstado = async () => estado;
    assert.equal(await f.casos().verificarCorreo('token'), 'cuenta_no_verificable');
  }
  f.tokens.verificarTokenVerificacion = () => { throw new Error('vencido'); };
  f.calls.length = 0;
  assert.equal(await f.casos().verificarCorreo('token'), 'enlace_invalido');
  assert.deepEqual(f.calls, []);
});

test('recuperación normaliza correo, construye enlace y no revela si existe', async () => {
  const f = fixture();
  const result = await f.casos().solicitarRecuperacion(' TEST@example.org ');
  assert.deepEqual(f.calls[0], ['buscar', 'test@example.org']);
  assert.equal(f.calls[1][1].enlace, 'http://localhost:5173/restablecer?token=recuperar%2B%2F%3D');
  f.repo.buscarPorCorreoConRol = async () => null;
  f.calls.length = 0;
  assert.deepEqual(await f.casos().solicitarRecuperacion('missing@example.org'), result);
  assert.deepEqual(f.calls, []);
  await assert.rejects(f.casos().solicitarRecuperacion(''), { estado: 400 });
});

test('fallos de correo: recuperación y reenvío rechazan sin anunciar éxito', async () => {
  const f = fixture();
  f.correo.enviarCorreoRecuperacion = async () => { throw new Error('SMTP falló'); };
  f.correo.enviarCorreoVerificacion = async () => { throw new Error('SMTP falló'); };
  await assert.rejects(f.casos().solicitarRecuperacion('test@example.org'), /SMTP falló/);
  await assert.rejects(f.casos().reenviarVerificacion('test@example.org'), /SMTP falló/);
});

test('reenvío valida correo, filtra pendiente y conserva respuesta no reveladora', async () => {
  const f = fixture();
  await assert.rejects(f.casos().reenviarVerificacion('inválido'), { estado: 400 });
  const result = await f.casos().reenviarVerificacion(' TEST@example.org ');
  assert.deepEqual(f.calls[0], ['pendiente', 'test@example.org', 'INACTIVO']);
  assert.equal(f.calls[1][0], 'verificacion');
  f.calls.length = 0;
  f.repo.buscarPendientePorCorreo = async () => null;
  assert.deepEqual(await f.casos().reenviarVerificacion('missing@example.org'), result);
  assert.deepEqual(f.calls, []);
});

test('restablecimiento: token inválido no hashea ni persiste; usuario ausente y fallo DB se propagan', async () => {
  const f = fixture();
  await assert.rejects(f.casos().restablecerPassword('', 'Aa1!aaaa'), { estado: 400 });
  f.tokens.verificarTokenRecuperacion = () => { throw new Error('vencido'); };
  await assert.rejects(f.casos().restablecerPassword('vencido', 'Aa1!aaaa'), { estado: 400 });
  assert.deepEqual(f.calls, []);
  f.tokens.verificarTokenRecuperacion = () => ({ sub: 'usuario' });
  f.repo.actualizarPassword = async () => null;
  await assert.rejects(f.casos().restablecerPassword('valido', 'Aa1!aaaa'), { estado: 404 });
  f.repo.actualizarPassword = async () => { throw new Error('DB falló'); };
  await assert.rejects(f.casos().restablecerPassword('valido', 'Aa1!aaaa'), /DB falló/);
});

test('perfil existente y ausente', async () => {
  const f = fixture();
  assert.deepEqual(await f.casos().obtenerPerfil('usuario'), { usuario: { id: 'usuario', rol: 'CLIENTE' } });
  f.repo.buscarPorIdConRol = async () => null;
  await assert.rejects(f.casos().obtenerPerfil('ausente'), { estado: 404 });
});

test('HTTP auth conserva rutas, estados, códigos, redirecciones y protección', async (t) => {
  const f = fixture();
  const controller = crearAuthController({ casos: f.casos(), frontendUrl: 'http://localhost:5173' });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', crearAuthRoutes(controller, crearRequiereAuth((token) => {
    if (token !== 'sesion') throw new Error('inválido');
    return { sub: 'usuario' };
  })));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (ruta, body) => fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (const password of ['invalida', 'Aa1!' + 'é'.repeat(35)]) {
    assert.equal((await post('/register', { nombre_completo: 'Prueba', correo_electronico: 'test@example.org', password })).status, 400);
    assert.equal((await post('/restablecer', { token: 'valido', password })).status, 400);
  }
  assert.deepEqual(f.calls, []);
  const registro = await post('/register', { nombre_completo: 'Prueba', correo_electronico: 'test@example.org', password: 'Aa1!aaaa' });
  assert.equal(registro.status, 201);
  assert.equal((await registro.json()).correo_enviado, true);
  assert.equal((await post('/login', { correo_electronico: 'test@example.org', password: 'anterior' })).status, 200);
  assert.equal((await fetch(base + '/me')).status, 401);
  assert.equal((await fetch(base + '/me', { headers: { Authorization: 'Bearer inválido' } })).status, 401);
  assert.equal((await fetch(base + '/me', { headers: { Authorization: 'Bearer sesion' } })).status, 200);
  const redirect = await fetch(base + '/verificar?token=valido', { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'http://localhost:5173/login?verificado=1');
  assert.equal((await post('/recuperar', { email: 'test@example.org' })).status, 200);
  assert.equal((await post('/reenviar-verificacion', { correo_electronico: 'test@example.org' })).status, 200);
  assert.equal((await post('/restablecer', { token: 'valido', password: 'Aa1!aaaa' })).status, 200);
  f.repo.buscarPorCorreoConRol = async () => { throw new Error('detalle interno simulado'); };
  const failed = await post('/recuperar', { email: 'test@example.org' });
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: 'Error interno del servidor' });
});
