const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { crearCasosCuenta } = require('../src/usecases/cuenta');
const { crearCuentaRoutes } = require('../src/controllers/cuentaRoutes');
const { crearCambioCorreoRoutes } = require('../src/controllers/cambioCorreoRoutes');
const { crearRequiereAuth } = require('../src/controllers/middleware/auth');

test('perfil propio: rechaza campos ajenos y usa exclusivamente identidad verificada', async t => {
  const llamadas = [];
  const casos = crearCasosCuenta({ repo: { guardarNombre: async (id, nombre) => { llamadas.push({id,nombre}); return { id, nombre_completo: nombre, rol: 'CLIENTE' }; } } });
  const auth = crearRequiereAuth(token => ({ sub: 'titular', rol: 'ADMIN', token }), async () => ({ rol: 'CLIENTE', estado_cuenta: 'ACTIVO' }));
  const app = express(); app.use(express.json()); app.use('/api/cuenta', crearCuentaRoutes(casos, auth));
  const correo = { estado: async id => ({ id }) };
  app.use('/api/cuenta/cambio-correo', crearCambioCorreoRoutes(correo, auth, ['ADMIN','CLIENTE']));
  app.use('/api/admin/cambio-correo', crearCambioCorreoRoutes(correo, auth));
  const server = app.listen(0,'127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => new Promise(r => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const enviar = (body, path='/api/cuenta/perfil', autorizado=true) => fetch(url+path, {method:'PATCH',headers:{'Content-Type':'application/json', ...(autorizado ? {Authorization:'Bearer prueba'} : {})},body:JSON.stringify(body)});
  assert.equal((await enviar({nombre_completo:'Ana'},undefined,false)).status,401);
  for(const campo of ['id','usuario_id','rol','estado_cuenta','plan_id','cuota_storage_gb','correo_electronico']) {
    assert.equal((await enviar({nombre_completo:'Ana',[campo]:'ajeno'})).status,400);
  }
  assert.equal((await enviar({nombre_completo:'Ana'},'/api/cuenta/perfil/ajeno')).status,404);
  assert.equal(llamadas.length,0);
  const r=await enviar({nombre_completo:'  Ana Nueva  '});
  assert.equal(r.status,200); assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(llamadas,[{id:'titular',nombre:'Ana Nueva'}]);
  assert.equal((await r.json()).usuario.rol,'CLIENTE');
  const headers={Authorization:'Bearer prueba'};
  assert.equal((await fetch(url+'/api/admin/cambio-correo',{headers})).status,403);
  assert.equal((await fetch(url+'/api/cuenta/cambio-correo',{headers})).status,200);
});

test('perfil rechaza nombres vacíos, cuentas inactivas y datos inválidos', async () => {
  const casos=crearCasosCuenta({repo:{guardarNombre:async()=>null}});
  for(const datos of [null, [], {}, {nombre_completo:''}, {nombre_completo:' '.repeat(4)}, {nombre_completo:'a'.repeat(151)}]) await assert.rejects(casos.guardarNombre('uno',datos),{estado:400});
  await assert.rejects(casos.guardarNombre('uno',{nombre_completo:'Ana'}),{estado:403});
});
