const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { migrar } = require('../../src/infrastructure/migraciones');
const { crearAdminRepositorio } = require('../../src/infrastructure/adminRepositorio');
const { crearCasosAdministracion } = require('../../src/usecases/administracion');
const { enviarAvisosRetiro } = require('../../src/infrastructure/enviarAvisosRetiro');

test('avisos de retiro: transacción, destinatarios, reintentos, concurrencia y reactivación', async t => {
  const url = new URL(process.env.TEST_MIGRATIONS_DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname) && url.pathname === '/vaultly_migraciones_test');
  const db = new Pool({connectionString:url.toString()});
  const schema = 'avisos_' + randomUUID().replaceAll('-','');
  await db.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({connectionString:url.toString(),options:`-c search_path=${schema},public`});
  t.after(async()=>{await pool.end();await db.query(`DROP SCHEMA ${schema} CASCADE`);await db.end();});
  await migrar(pool,()=>{}); await migrar(pool,()=>{});
  const actor=randomUUID(), clientes=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
  for(const [i,id] of [actor,...clientes].entries()) await pool.query("INSERT INTO usuarios(id,rol_id,nombre_completo,correo_electronico,password_hash) VALUES($1,$2,$3,$4,'fixture')",[id,i===0?1:2,`Persona ${i}`,`${id}@example.test`]);
  const repo=crearAdminRepositorio(pool), admin=crearCasosAdministracion({repo});
  let plan=await admin.guardarPlan(actor,null,{nombre:'Max',precio_mensual:200,cuota_storage_gb:100,limite_descargas:100,activo:true,permite_carpetas_publicas:true});
  await pool.query("UPDATE suscripciones SET estado='VENCIDA' WHERE usuario_id=ANY($1::uuid[])",[clientes]);
  for(const [i,id] of clientes.entries()) await pool.query(`INSERT INTO suscripciones(usuario_id,plan_id,fecha_inicio,fecha_fin,estado,renovacion_automatica)
    VALUES($1,$2,clock_timestamp()+$3*interval '1 day',clock_timestamp()+$4*interval '1 day',$5,$6)`,[id,plan.id,i===2?1:-5,i===3?-1:30,i===2?'PENDIENTE':i===3?'VENCIDA':'ACTIVA',i===0]);
  assert.equal((await repo.listarPlanes()).find(p=>p.id===plan.id).tiene_suscripciones,true);
  for(const cambio of [{nombre:'Otro'},{precio_mensual:300},{cuota_storage_gb:1},{limite_descargas:0},{permite_carpetas_publicas:false}]) await assert.rejects(admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,...cambio}),/suscripciones/);
  // Si no se puede preparar el correo, no se confirma el retiro ni su auditoría.
  const roto=crearCasosAdministracion({repo:{transaccion:(tipo,fn)=>repo.transaccion(tipo,tx=>fn({...tx,encolarAvisosRetiro:async p=>{await tx.encolarAvisosRetiro(p);throw Error('fallo cola');}}))}});
  await assert.rejects(roto.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,activo:false}),/fallo cola/);
  assert.equal((await pool.query('SELECT * FROM correos_retiro_planes')).rowCount,0);
  assert.equal((await pool.query('SELECT activo FROM planes WHERE id=$1',[plan.id])).rows[0].activo,true);
  plan=await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,activo:false});
  assert.equal((await pool.query('SELECT * FROM correos_retiro_planes')).rowCount,3);
  await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200}); // Guardar de nuevo no duplica.
  assert.equal((await pool.query('SELECT * FROM correos_retiro_planes')).rowCount,3);
  assert.equal((await enviarAvisosRetiro(pool,async()=>{throw Error('SMTP caído');})).fallos,3);
  assert.equal((await pool.query("SELECT * FROM correos_retiro_planes WHERE estado='PENDIENTE' AND intentos=1 AND proximo_intento>clock_timestamp()")).rowCount,3);
  await pool.query('UPDATE correos_retiro_planes SET proximo_intento=clock_timestamp()');
  await pool.query('UPDATE usuarios SET correo_electronico=$2 WHERE id=$1',[clientes[0],'actualizado@example.test']);
  const enviados=[];
  await Promise.all([enviarAvisosRetiro(pool,async m=>enviados.push(m)),enviarAvisosRetiro(pool,async m=>enviados.push(m))]);
  assert.equal(enviados.length,3); assert.equal(new Set(enviados.map(m=>m.id)).size,3);
  assert.ok(enviados.some(m=>m.para==='actualizado@example.test'));
  assert.equal((await enviarAvisosRetiro(pool,async()=>assert.fail('Correo duplicado'))).enviados,0);
  plan=(await pool.query('SELECT * FROM planes WHERE id=$1',[plan.id])).rows[0];
  plan=await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,activo:true});
  plan=await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,activo:false});
  plan=await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,activo:true});
  assert.equal((await enviarAvisosRetiro(pool,async()=>assert.fail('Plan reactivado'))).cancelados,3);
  plan=await admin.guardarPlan(actor,plan.id,{...plan,precio_mensual:200,activo:false});
  await pool.query("UPDATE suscripciones SET estado='CANCELADA' WHERE usuario_id=$1 AND plan_id=$2",[clientes[0],plan.id]);
  const final=await enviarAvisosRetiro(pool,async()=>{});
  assert.equal(final.cancelados,1);assert.equal(final.enviados,2);
});
