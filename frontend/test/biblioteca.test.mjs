import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearBibliotecaDemo, archivosDemo } from '../src/biblioteca/demo.ts';
import { crearBibliotecaHttp } from '../src/biblioteca/http.ts';
import { leerConsulta, serializar, cambiarConsulta, limpiarConsulta, textoResultados, crearSolicitudActual } from '../src/biblioteca/estado.ts';

const base = () => leerConsulta(new URLSearchParams());
const signal = () => new AbortController().signal;
test('URL: parámetros repetidos, caracteres especiales, recarga y valores inválidos', () => {
  const consulta = {...base(), q:'diseño & API', etiquetas:[1,4], autor:archivosDemo[0].autor.id, tipo:'documentos', orden:'nombre_asc', pagina:3};
  const p = serializar(consulta,true);
  assert.deepEqual(p.getAll('etiqueta_id'), ['1','4']); assert.equal(p.get('por_pagina'),'12');
  assert.deepEqual(leerConsulta(p),consulta);
  assert.deepEqual(leerConsulta(new URLSearchParams('pagina=-3&orden=falso&tipo=falso&etiqueta_id=a')), base());
});
test('limpiar conserva orden; cambiar filtros, texto u orden reinicia página', () => {
  const c={...base(), q:'hola', tipo:'audio', etiquetas:[2], autor:'autor', orden:'antiguos', pagina:3};
  assert.deepEqual(limpiarConsulta(c), {...base(),orden:'antiguos'});
  for(const cambio of [{q:'otro'}, {tipo:'videos'}, {etiquetas:[]}, {autor:''}, {orden:'nombre_asc'}]) assert.equal(cambiarConsulta(c,cambio).pagina,1);
  const borrarTexto=cambiarConsulta(c,{q:''}); assert.deepEqual(borrarTexto.etiquetas,[2]); assert.equal(borrarTexto.autor,'autor');
  assert.equal(cambiarConsulta(c,{pagina:2}).pagina,2);
});
test('demostración: AND entre filtros, OR de etiquetas, búsqueda parcial sin acentos', async () => {
  const demo=crearBibliotecaDemo();
  const resultado=await demo.buscar({...base(),q:'ana',tipo:'documentos',autor:archivosDemo[1].autor.id,etiquetas:[4,17]},signal());
  assert.deepEqual(resultado.items.map(a=>a.nombre_original).sort(), ['Manual_Despliegue_AWS.pdf','Resumen_Matemáticas.pdf']);
  assert.equal((await demo.buscar({...base(),q:'matematic'},signal())).total,1);
  assert.equal((await demo.buscar({...base(),q:'xyz123'},signal())).total,0);
  assert.equal((await crearBibliotecaDemo([]).buscar(base(),signal())).total,0);
});
test('total real del conjunto, páginas, orden y rangos sin cero incorrecto', async () => {
  const demo=crearBibliotecaDemo();
  const primera=await demo.buscar(base(),signal()), segunda=await demo.buscar({...base(),pagina:2},signal());
  assert.equal(primera.items.length,12); assert.equal(primera.total,18); assert.equal(segunda.items.length,6);
  assert.ok(!segunda.items.some(a=>primera.items.some(b=>b.id===a.id)));
  assert.equal(textoResultados(18,2,false,6),'Mostrando 13–18 de 18 archivos');
  assert.equal(textoResultados(0,1,true,0),'0 archivos encontrados');
  assert.equal(textoResultados(1,1,false,1),'1 archivo disponible');
  assert.equal((await demo.buscar({...base(),orden:'antiguos'},signal())).items[0].id,archivosDemo.at(-1).id);
  const mayor=await demo.buscar({...base(),orden:'tamanio_desc'},signal());
  assert.equal(mayor.items[0].nombre_original,'Assets_Ilustraciones_3D.zip');
});
test('opciones públicas, búsqueda y datos compatibles con contrato sin correos ni MinIO', async () => {
  const demo=crearBibliotecaDemo();
  assert.equal((await demo.autores('perez',signal())).items[0].nombre_completo,'Fernando Pérez');
  assert.equal((await demo.etiquetas('matematic',signal())).items[0].nombre,'Matemáticas');
  for(const a of archivosDemo) {
    assert.match(a.id,/^[a-f\d-]{36}$/); assert.equal(typeof a.tamanio_bytes,'string'); assert.ok(BigInt(a.tamanio_bytes)>=0n);
    assert.ok(Number.isFinite(Date.parse(a.created_at))); assert.equal(typeof a.autor.nombre_completo,'string');
    assert.ok(!('correo_electronico' in a.autor)); assert.ok(!('ruta_minio' in a));
  }
});
test('HTTP: contrato independiente, autenticación, errores y ausencia de fallback ficticio', async () => {
  let url, opciones;
  const http=crearBibliotecaHttp('http://example.test',()=> 'token-test',async (u,o)=>{
    url=u;opciones=o;return Response.json({items:[],total:0,pagina:1,por_pagina:12});
  });
  await http.buscar({...base(),q:'hola',etiquetas:[1,2]},signal());
  assert.match(url,/\/api\/biblioteca\/archivos\?/); assert.equal(new URL(url).searchParams.getAll('etiqueta_id').length,2);
  assert.equal(opciones.headers.Authorization,'Bearer token-test'); assert.ok(opciones.signal);
  const falla=crearBibliotecaHttp('',()=> 'token',async()=>Response.json({error:'Servicio pendiente'}, {status:503}));
  await assert.rejects(falla.buscar(base(),signal()),/Servicio pendiente/);
  const invalido=crearBibliotecaHttp('',()=> 'token',async()=>Response.json([]));
  await assert.rejects(invalido.buscar(base(),signal()),/inválida/);
  const malArchivo=crearBibliotecaHttp('',()=> 'token',async()=>Response.json({items:[{id:'incompleto'}],total:1,pagina:1,por_pagina:12}));
  await assert.rejects(malArchivo.buscar(base(),signal()),/formato inválido/);
  await assert.rejects(crearBibliotecaHttp('',()=>null).buscar(base(),signal()),/sesión/);
});
test('respuestas fuera de orden y errores tardíos no reemplazan la solicitud actual', async () => {
  const control=crearSolicitudActual(), resultados=[], errores=[];
  let resolverA, resolverB, signalA;
  const a=control.ejecutar(s=>{signalA=s;return new Promise(r=>resolverA=r);},v=>resultados.push(v),e=>errores.push(e));
  const b=control.ejecutar(()=>new Promise(r=>resolverB=r),v=>resultados.push(v),e=>errores.push(e));
  assert.ok(signalA.aborted); resolverB('nuevo');await b;resolverA('antiguo');await a;
  assert.deepEqual(resultados,['nuevo']);assert.deepEqual(errores,[]);
  let rechazar;
  const c=control.ejecutar(()=>new Promise((_,r)=>rechazar=r),v=>resultados.push(v),e=>errores.push(e));
  control.cancelar();rechazar(new Error('tardío'));await c;assert.deepEqual(errores,[]);
});
