const { test } = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const express = require('express');
const { crearCasosCambioCorreo } = require('../src/usecases/cambioCorreo');
const { crearCorreoCambio } = require('../src/infrastructure/correoCambio');
const { crearCambioCorreoRoutes } = require('../src/controllers/cambioCorreoRoutes');
const { crearRequiereAuth } = require('../src/controllers/middleware/auth');
function fixture() {
  let ahora = new Date('2026-10-28T12:00:00Z');
  let solicitud = { intentos: 0, envios: 0, fallos_password: 0, estado: 'CANCELADO' };
  const usuario = { id: 'uno', nombre_completo: 'Ana', correo_electronico: 'antes@example.test', password_hash: 'hash:actual' };
  const mensajes = []; let ocupado = false, fallar = false, notificacionFalla = false, secuencia = 0;
  const repo = { conUsuario: async (id, fn) => {
    assert.equal(id, 'uno');
    const copia = structuredClone(solicitud);
    const r = await fn({ usuario, solicitud: copia, ahora, ocupado: async () => ocupado,
      guardar: async s => { solicitud = structuredClone(s); }, cambiarCorreo: async correo => { usuario.correo_electronico = correo; return { id: usuario.id, nombre_completo: usuario.nombre_completo, correo_electronico: correo }; } });
    return r;
  } };
  const transporte = nodemailer.createTransport({ jsonTransport: true });
  const correo = crearCorreoCambio(async mensaje => {
    if (fallar || (notificacionFalla && mensaje.subject === 'Tu correo de Vaultly cambió')) throw Error('SMTP privado');
    const r = await transporte.sendMail({ ...mensaje, from: 'vaultly@example.test' }); mensajes.push(JSON.parse(r.message));
  });
  const casos = crearCasosCambioCorreo({ repo, correo,
    contrasenas: { hashear: async x => `hash:${x}`, comparar: async (a, b) => `hash:${a}` === b },
    codigos: { generar: () => String(++secuencia).padStart(6, '0'), id: () => `solicitud-${secuencia}` } });
  return { casos, usuario, mensajes, solicitud: () => solicitud, avanzar: ms => { ahora = new Date(+ahora + ms); },
    ocupado: v => { ocupado = v; }, fallo: v => { fallar = v; }, falloAviso: () => { notificacionFalla = true; },
    pedir: (datos = {}) => casos.solicitar('uno', { correo: 'nuevo@example.test', password: 'actual', ...datos }),
    confirmar: (codigo = '000001', id = solicitud.solicitud_id) => casos.confirmar('uno', { solicitud_id: id, codigo }) };
}
test('envío con transporte JSON, correo anterior intacto, confirmación y un solo uso', async () => {
  const f = fixture(); const r = await f.pedir();
  assert.equal(f.usuario.correo_electronico, 'antes@example.test');
  assert.equal(r.solicitud.correo, 'nuevo@example.test');
  assert.equal(r.solicitud.codigo_hash, undefined);
  assert.match(f.mensajes[0].text, /000001/);
  assert.equal((await f.confirmar()).usuario.correo_electronico, 'nuevo@example.test');
  assert.equal(f.mensajes[1].to[0].address, 'antes@example.test');
  assert.equal(f.solicitud().codigo_hash, null);
  await assert.rejects(f.confirmar(), { codigo: 'CODIGO_NO_DISPONIBLE' });
});
test('contraseña incorrecta tiene límite persistido y no envía; correo ocupado/igual/inválido no cambia', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) await assert.rejects(f.pedir({ password: 'mala' }), { codigo: 'PASSWORD_INVALIDA' });
  await assert.rejects(f.pedir(), { codigo: 'PASSWORD_LIMITE' });
  f.avanzar(15 * 60000); f.ocupado(true);
  await assert.rejects(f.pedir(), { codigo: 'CORREO_OCUPADO' });
  await assert.rejects(f.pedir({ correo: 'antes@example.test' }), { codigo: 'CORREO_IGUAL' });
  await assert.rejects(f.pedir({ correo: 'invalido' }), { codigo: 'CORREO_INVALIDO' });
  assert.equal(f.mensajes.length, 0); assert.equal(f.usuario.correo_electronico, 'antes@example.test');
});
test('cinco códigos erróneos bloquean; vencimiento y vínculo de solicitud se verifican', async () => {
  const f = fixture(); await f.pedir();
  await assert.rejects(f.confirmar('000001', 'ajena'), { codigo: 'CODIGO_NO_DISPONIBLE' });
  for (let i = 0; i < 5; i++) await assert.rejects(f.confirmar('999999'), { codigo: i === 4 ? 'CODIGO_LIMITE' : 'CODIGO_INVALIDO' });
  await assert.rejects(f.confirmar(), { codigo: 'CODIGO_NO_DISPONIBLE' });
  const g = fixture(); await g.pedir(); g.avanzar(600000);
  await assert.rejects(g.confirmar(), { codigo: 'CODIGO_VENCIDO' });
  assert.equal(g.usuario.correo_electronico, 'antes@example.test');
});
test('reenviar invalida el código anterior; cancelar no permite saltarse el cooldown ni límite horario', async () => {
  const f = fixture(); await f.pedir(); const anterior = f.solicitud().solicitud_id;
  await assert.rejects(f.pedir(), { codigo: 'REENVIO_ESPERA' });
  f.avanzar(60000); await f.pedir();
  await assert.rejects(f.confirmar('000001', anterior), { codigo: 'CODIGO_NO_DISPONIBLE' });
  await f.casos.cancelar('uno');
  await assert.rejects(f.confirmar('000003'), { codigo: 'CODIGO_NO_DISPONIBLE' });
  await assert.rejects(f.pedir(), { codigo: 'REENVIO_ESPERA' });
  for (let i = 0; i < 3; i++) { f.avanzar(60000); await f.pedir(); }
  f.avanzar(60000); await assert.rejects(f.pedir(), { codigo: 'ENVIOS_LIMITE' });
});
test('correo ocupado al confirmar conserva dirección y solicitud', async () => {
  const f = fixture(); await f.pedir(); f.ocupado(true);
  await assert.rejects(f.confirmar(), { codigo: 'CORREO_OCUPADO' });
  assert.equal(f.usuario.correo_electronico, 'antes@example.test');
  assert.equal(f.solicitud().estado, 'PENDIENTE');
});
test('fallo SMTP conserva correo, invalida código y mantiene espera; fallo aviso posterior no revierte éxito', async () => {
  const f = fixture(); f.fallo(true);
  await assert.rejects(f.pedir(), { codigo: 'ENVIO_FALLIDO' });
  assert.equal(f.usuario.correo_electronico, 'antes@example.test'); assert.equal(f.solicitud().codigo_hash, null);
  await assert.rejects(f.pedir(), { codigo: 'REENVIO_ESPERA' });
  const g = fixture(); await g.pedir(); g.falloAviso();
  const r = await g.confirmar(); assert.equal(r.notificado, false); assert.equal(r.usuario.correo_electronico, 'nuevo@example.test');
});
test('rutas de cambio de correo exigen autenticación/ADMIN y ocultan detalles inesperados', async t => {
  const app = express(); app.use(express.json());
  const auth = crearRequiereAuth(token => ({ sub: 'uno', rol: token }));
  const casos = { estado: async () => { throw Error('SELECT secreto'); }, solicitar: async () => ({}), confirmar: async () => ({}), cancelar: async () => ({}) };
  app.use('/correo', crearCambioCorreoRoutes(casos, auth));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => new Promise(r => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/correo`;
  for (const [method, suffix] of [['GET',''],['POST',''],['POST','/confirmar'],['DELETE','']]) {
    assert.equal((await fetch(url + suffix, { method })).status, 401);
    assert.equal((await fetch(url + suffix, { method, headers: { Authorization: 'Bearer CLIENTE' } })).status, 403);
  }
  const r = await fetch(url, { headers: { Authorization: 'Bearer ADMIN' } });
  assert.equal(r.status, 500); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await r.text(), /SELECT|secreto/);
});

test('rechaza dominios con errores frecuentes y formatos inválidos antes de enviar', async () => {
  const f = fixture();
  for (const correo of ['a@gmail.co', 'a@gmial.com', 'a@gmail.con']) {
    await assert.rejects(f.pedir({ correo }), { codigo: 'CORREO_DOMINIO' });
  }
  for (const correo of ['a..b@example.com', '.a@example.com', 'a@-dominio.com', 'a@dominio..com', 'a@dominio.c']) {
    await assert.rejects(f.pedir({ correo }), { codigo: 'CORREO_INVALIDO' });
  }
  assert.equal(f.mensajes.length, 0);
  await f.pedir({ correo: 'ana+cuenta@empresa.co' });
  assert.equal(f.mensajes.length, 1);
});

test('mensaje HTML destaca código, conserva texto y escapa datos del usuario', async () => {
  let mensaje;
  const correo = crearCorreoCambio(async m => { mensaje = m; });
  await correo.enviarCodigo({ para: 'ana@example.test', nombre: '<img src=x onerror=alert(1)>', codigo: '123456', minutos: 10 });
  assert.match(mensaje.html, /123456/);
  assert.match(mensaje.html, /10 minutos/);
  assert.match(mensaje.html, /&lt;img/);
  assert.doesNotMatch(mensaje.html, /<img/);
  assert.match(mensaje.text, /123456/);
});
