const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { crearArchivosRoutes } = require('../src/controllers/archivosRoutes');
const { crearCasosArchivos } = require('../src/usecases/archivos');
const { cuotasArchivoDoble } = require('./cuotasArchivoDoble');

test('HTTP etiquetas: multipart omitido/JSON, validación y PATCH autorizado', async t => {
  let archivo;
  const repositorio = {
    registrar: async datos => (archivo = { id:'id', usuario:datos.usuarioId, etiquetas:datos.etiquetas.map((nombre,id)=>({id,nombre})) }),
    reemplazarEtiquetas: async (id, usuario, nombres) => {
      if (id !== archivo.id || usuario !== archivo.usuario) return null;
      return (archivo = {...archivo, etiquetas:nombres.map((nombre,id)=>({id,nombre}))});
    },
  };
  const almacenamiento = {guardar: async ()=>'objeto', eliminar:async()=>{}};
  const casos = crearCasosArchivos({repositorio, almacenamiento, cuotas:cuotasArchivoDoble(repositorio, almacenamiento)});
  const app = express(); app.use(express.json());
  app.use('/api/archivos', crearArchivosRoutes(casos, (req,res,next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.usuario={sub:req.headers.authorization}; next();
  }));
  app.use(require('../src/controllers/jsonInvalido'));
  const server = await new Promise(resolve => {const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/archivos`;
  const subir = async entrada => {
    const body=new FormData(); body.append('archivo',new Blob(['hola']),'test.txt');
    if (entrada !== undefined) body.append('etiquetas',entrada);
    return fetch(base,{method:'POST',headers:{Authorization:'autor'},body});
  };
  const sin=await subir(); assert.equal(sin.status,201); assert.deepEqual((await sin.json()).etiquetas,[]);
  const con=await subir('[" Matemáticas ","matemáticas","bases de datos"]');
  assert.equal(con.status,201); assert.deepEqual((await con.json()).etiquetas.map(e=>e.nombre),['matemáticas','bases de datos']);
  for(const valor of ['[', '{}', 'null', '[1]', '[""]', '["a","b","c","d","e","f"]']) {
    const res=await subir(valor); assert.equal(res.status,400); assert.equal(typeof (await res.json()).error,'string');
  }
  const patch=(id,body,usuario='autor')=>fetch(`${base}/${id}/etiquetas`,{method:'PATCH',headers:{Authorization:usuario,'Content-Type':'application/json'},body});
  for(const id of ['id','ausente']) assert.equal((await patch(id,'{"etiquetas":[]}','otro')).status,404);
  assert.equal((await patch('id','{}')).status,400);
  const mal=await patch('id','{'); assert.equal(mal.status,400); assert.match((await mal.json()).error,/JSON/);
  const vacio=await patch('id','{"etiquetas":[]}'); assert.equal(vacio.status,200); assert.deepEqual((await vacio.json()).etiquetas,[]);
});
