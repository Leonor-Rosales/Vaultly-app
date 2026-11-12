const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCorreoRetiroPlan } = require('../src/infrastructure/correoRetiroPlan');
const { crearCorreoCambio } = require('../src/infrastructure/correoCambio');

test('correo de retiro usa la plantilla existente, fecha Guatemala y datos escapados', async () => {
  let mensaje;
  await crearCorreoRetiroPlan(async m => { mensaje = m; }, 'https://vaultly.example')({ id: '42', para: 'cliente@example.test', nombre: '<img src=x>', plan: 'Max <script>', fechaFin: '2026-12-12T05:30:00Z' });
  assert.equal(mensaje.to,'cliente@example.test');
  assert.equal(mensaje.messageId,'<retiro-plan-42@vaultly.invalid>');
  assert.ok(mensaje.text.includes('11 de diciembre de 2026'));
  assert.ok(mensaje.text.includes('aunque tuvieras activada la renovación automática'));
  assert.ok(mensaje.text.includes('sin otro cobro'));
  assert.ok(mensaje.html.includes('https://vaultly.example/planes#catalogo'));
  assert.ok(mensaje.html.includes('&lt;img src=x&gt;'));
  assert.ok(!mensaje.html.includes('<script>'));
  let cambio;
  await crearCorreoCambio(async m => { cambio=m; }).enviarCodigo({para:'otra@example.test',nombre:'Ana',codigo:'123456',minutos:10});
  for (const contenido of ['TU CUENTA, SIEMPRE PROTEGIDA','max-width:520px','background:#fcfaf8']) {
    assert.ok(mensaje.html.includes(contenido)); assert.ok(cambio.html.includes(contenido));
  }
  assert.ok(cambio.html.includes('123456'));
});

test('destinatarios rechazados por SMTP quedan como fallo para reintentar', async () => {
  for (const resultado of [{accepted:[],rejected:['cliente@example.test']},{accepted:[]}]) {
    await assert.rejects(crearCorreoRetiroPlan(async()=>resultado,'https://vaultly.example')({id:'1',para:'cliente@example.test',nombre:'Ana',plan:'Max',fechaFin:'2026-12-12T18:00:00Z'}));
  }
});
