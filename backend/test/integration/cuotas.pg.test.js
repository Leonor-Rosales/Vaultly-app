const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const Minio = require('minio');
const loadWith = require('../loadWith');
const { crearCuotasRepositorio } = require('../../src/infrastructure/cuotasRepositorio');
const { crearArchivoRepositorio } = require('../../src/infrastructure/archivoRepositorio');
const { crearCasosCuotas } = require('../../src/usecases/cuotas');
const { crearCasosArchivos } = require('../../src/usecases/archivos');

test('integración aislada PostgreSQL + MinIO: cuotas, concurrencia y migraciones', async t => {
  const url = new URL(process.env.TEST_DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/vaultly_cuotas_test', 'Solo se permite la base local exclusiva vaultly_cuotas_test');
  assert.ok(process.env.TEST_MINIO_PORT, 'Se requiere MinIO exclusivo de pruebas');
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: url.toString() });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema},public`, max: 12 });
  const minio = new Minio.Client({ endPoint: '127.0.0.1', port: Number(process.env.TEST_MINIO_PORT), useSSL: false, accessKey: 'vaultlytest', secretKey: 'vaultly-test-only' });
  const bucket = schema.replaceAll('_', '-');
  await minio.makeBucket(bucket);
  t.after(async () => {
    const objetos = [];
    for await (const obj of minio.listObjectsV2(bucket, '', true)) objetos.push(obj.name);
    if (objetos.length) await minio.removeObjects(bucket, objetos);
    await minio.removeBucket(bucket);
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); // Solo el esquema UUID de esta prueba.
    await admin.end();
  });
  const sql = (name) => fs.readFileSync(path.resolve(__dirname, '../../..', 'init-db', name), 'utf8');
  await pool.query(sql('01_schema.sql'));
  await pool.query(sql('02_seeds.sql'));
  const usuario = async () => {
    const id = randomUUID();
    await pool.query("INSERT INTO usuarios(id,rol_id,nombre_completo,correo_electronico,password_hash) VALUES($1,1,'Prueba',$2,'hash-ficticio')", [id, `${id}@example.test`]);
    return id;
  };
  const previo = await usuario();
  const conPlanPrevio = await usuario();
  await pool.query("INSERT INTO suscripciones(usuario_id,plan_id,fecha_inicio,fecha_fin,estado,descargas_consumidas_ciclo) SELECT $1,id,now()-interval '1 day',now()+interval '2 days','ACTIVA',1 FROM planes WHERE nombre='Free'", [conPlanPrevio]);
  await pool.query(sql('03_planes_cuotas.sql'));
  const almacenamiento = loadWith(path.resolve(__dirname, '../../src/infrastructure/almacenamientoMinio.js'), {
    './minioCliente': { minio, MINIO_BUCKET: bucket, asegurarBucket: async () => {} },
  });
  const repo = crearCuotasRepositorio(pool);
  const cuotas = crearCasosCuotas({ repo, almacenamiento });
  const archivos = crearArchivoRepositorio(pool);
  const casos = crearCasosArchivos({ repositorio: archivos, almacenamiento, cuotas });
  const dato = (size = 4) => ({ nombreOriginal: 'test.txt', tipoMime: 'text/plain', tamanioBytes: size, contenido: Buffer.alloc(size, 65) });
  const ocupar = (user, bytes) => archivos.registrar({ usuarioId: user, nombreOriginal: 'fixture', nombreObjeto: `${user}/${randomUUID()}`, rutaMinio: 'fixture', tamanioBytes: bytes, tipoMime: 'text/plain', esPublica: false });

  await t.test('etiquetas: migración consolida relaciones y es idempotente', async () => {
    const { migrarEtiquetas } = require('../../src/infrastructure/migrarEtiquetas');
    const u = await usuario();
    const a = await ocupar(u, 1), b = await ocupar(u, 1);
    const { rows } = await pool.query("INSERT INTO etiquetas(nombre) VALUES(' Matemáticas '),('matemáticas'),('matemáticas') RETURNING id");
    await pool.query('INSERT INTO archivo_etiquetas VALUES($1,$2),($3,$4),($1,$5)', [a.id, rows[0].id, b.id, rows[1].id, rows[2].id]);
    await migrarEtiquetas(pool); await migrarEtiquetas(pool);
    const lista = await casos.listar(u);
    assert.equal(lista[0].etiquetas[0].id, lista[1].etiquetas[0].id);
    assert.equal(lista[0].etiquetas[0].nombre, 'matemáticas');
    assert.equal((await pool.query('SELECT * FROM archivo_etiquetas WHERE archivo_id=ANY($1::uuid[])', [[a.id,b.id]])).rowCount, 2);
    await pool.query("INSERT INTO etiquetas(nombre) VALUES('Control' || chr(9))");
    await assert.rejects(migrarEtiquetas(pool), /control/);
    assert.equal((await pool.query("SELECT * FROM etiquetas WHERE nombre='Control' || chr(9)")).rowCount, 1);
    await pool.query("DELETE FROM etiquetas WHERE nombre='Control' || chr(9)");
  });
  await t.test('etiquetas: concurrencia, autorización, aislamiento, vaciado y cascada', async () => {
    const autor = await usuario(), otro = await usuario();
    const [a,b] = await Promise.all([
      casos.subir(autor, dato(), false, [' Compartida ', 'año']),
      casos.subir(otro, dato(), true, ['COMPARTIDA', 'ano']),
    ]);
    assert.equal(a.etiquetas.find(e=>e.nombre==='compartida').id, b.etiquetas.find(e=>e.nombre==='compartida').id);
    assert.equal((await pool.query("SELECT * FROM etiquetas WHERE nombre='compartida'")).rowCount, 1);
    const publicos = await casos.listarPublicos();
    assert.ok(!publicos.some(f=>f.id===a.id));
    assert.deepEqual(publicos.find(f=>f.id===b.id).etiquetas.map(e=>e.nombre), ['ano','compartida']);
    assert.ok(publicos.every(f=>!('ruta_minio' in f) && !('nombre_objeto_minio' in f)));
    await assert.rejects(casos.editarEtiquetas(a.id, otro, []), {estado:404});
    await assert.rejects(casos.editarEtiquetas(randomUUID(), autor, []), {estado:404});
    const antes = await cuotas.consultar(autor);
    const objetoAntes = await minio.statObject(bucket, (await archivos.buscarPorIdYUsuario(a.id,autor)).nombre_objeto_minio);
    const editado = await casos.editarEtiquetas(a.id, autor, ['1','2','3','4','5',' 5 ']);
    assert.equal(editado.etiquetas.length, 5);
    assert.deepEqual((await cuotas.consultar(autor)).almacenamiento, antes.almacenamiento);
    assert.deepEqual((await cuotas.consultar(autor)).descargas, antes.descargas);
    const objetoDespues = await minio.statObject(bucket, (await archivos.buscarPorIdYUsuario(a.id,autor)).nombre_objeto_minio);
    assert.equal(objetoAntes.etag, objetoDespues.etag);
    assert.deepEqual((await casos.editarEtiquetas(a.id, autor, [])).etiquetas, []);
    assert.equal((await pool.query("SELECT * FROM etiquetas WHERE nombre='compartida'")).rowCount, 1);
    await casos.eliminar(b.id, otro);
    assert.equal((await pool.query('SELECT * FROM archivo_etiquetas WHERE archivo_id=$1',[b.id])).rowCount, 0);
    const sin = await casos.subir(autor, dato(), false);
    assert.deepEqual(sin.etiquetas, []);
  });
  await t.test('etiquetas: fallo de relaciones revierte archivo y reserva, compensa MinIO y conserva edición previa', async () => {
    const u = await usuario();
    const a = await casos.subir(u,dato(),false,['anterior']);
    await pool.query(`CREATE FUNCTION rechazar_etiqueta() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fallo de relación simulado'; END $$;
      CREATE TRIGGER fallo_etiqueta BEFORE INSERT ON archivo_etiquetas FOR EACH ROW EXECUTE FUNCTION rechazar_etiqueta()`);
    try {
      await assert.rejects(casos.editarEtiquetas(a.id,u,['nueva']), /fallo de relación/);
      assert.deepEqual((await casos.listar(u))[0].etiquetas.map(e=>e.nombre), ['anterior']);
      await assert.rejects(casos.subir(u,dato(),false,['rollback']), /fallo de relación/);
      assert.equal((await casos.listar(u)).length, 1);
      assert.equal((await pool.query('SELECT * FROM reservas_subida WHERE usuario_id=$1',[u])).rowCount, 0);
      assert.equal((await pool.query("SELECT * FROM etiquetas WHERE nombre IN ('nueva','rollback')")).rowCount, 0);
      const objetos=[]; for await (const obj of minio.listObjectsV2(bucket,u+'/',true)) objetos.push(obj);
      assert.equal(objetos.length,1);
    } finally { await pool.query('DROP TRIGGER fallo_etiqueta ON archivo_etiquetas; DROP FUNCTION rechazar_etiqueta()'); }
  });

  await t.test('migración de existentes, Free al registrar, contador previo e idempotencia', async () => {
    assert.equal((await cuotas.consultar(previo)).plan.nombre, 'Free');
    assert.equal((await cuotas.consultar(conPlanPrevio)).descargas.consumidas, 1);
    const nuevo = await usuario();
    assert.equal((await pool.query("SELECT count(*) FROM suscripciones WHERE usuario_id=$1 AND estado='ACTIVA'", [nuevo])).rows[0].count, '1');
    await pool.query(sql('03_planes_cuotas.sql'));
    assert.equal((await cuotas.consultar(conPlanPrevio)).descargas.consumidas, 1);
    await assert.rejects(pool.query("INSERT INTO suscripciones(usuario_id,plan_id,fecha_inicio,fecha_fin,estado) SELECT $1,id,now(),now()+interval '1 day','ACTIVA' FROM planes WHERE nombre='Free'", [nuevo]), { code: '23505' });
  });
  await t.test('pagada vigente, vencida y archivos superiores a Free', async () => {
    const u = await usuario();
    await pool.query("UPDATE suscripciones SET plan_id=(SELECT id FROM planes WHERE nombre='Max Vault') WHERE usuario_id=$1", [u]);
    assert.equal((await cuotas.consultar(u)).plan.nombre, 'Max Vault');
    const archivo = await ocupar(u, 6000000000);
    await pool.query("UPDATE suscripciones SET fecha_inicio=now()-interval '2 months',fecha_fin=now()-interval '1 second' WHERE usuario_id=$1 AND estado='ACTIVA'", [u]);
    const actual = await cuotas.consultar(u);
    assert.equal(actual.plan.nombre, 'Free');
    assert.equal(actual.almacenamiento.usados_bytes, 6000000000);
    assert.equal(actual.almacenamiento.disponibles_bytes, 0);
    await assert.rejects(casos.subir(u, dato(), false), { codigo: 'CUOTA_ALMACENAMIENTO' });
    await casos.eliminar(archivo.id, u);
    assert.equal((await cuotas.consultar(u)).almacenamiento.usados_bytes, 0);
  });
  await t.test('biblioteca: propias gratis incluso agotado, ajenas públicas cobran al lector y privadas inaccesibles', async () => {
    // Reembolsa una vez los cargos de la versión anterior; nunca reinicia nuevos cargos.
    await pool.query(sql('04_descargas_biblioteca.sql'));
    assert.equal((await cuotas.consultar(conPlanPrevio)).descargas.consumidas, 0);
    const lector = await usuario(), autor = await usuario();
    const propia = await casos.subir(lector, dato(), false);
    const publica = await casos.subir(autor, dato(), true);
    const privada = await casos.subir(autor, dato(), false);
    const lista = await casos.listarPublicos();
    assert.ok(lista.some(a => a.id === publica.id));
    assert.ok(!lista.some(a => a.id === privada.id));
    assert.ok(!lista.some(a => 'nombre_objeto_minio' in a || 'ruta_minio' in a));
    for (let i = 0; i < 3; i++) {
      const d = await casos.descargar(propia.id, lector);
      await d.iniciar();
      for await (const chunk of d.stream) assert.equal(chunk.length, 4);
    }
    assert.equal((await cuotas.consultar(lector)).descargas.consumidas, 0);
    for (let i = 0; i < 2; i++) {
      const d = await casos.descargar(publica.id, lector);
      await d.iniciar();
      for await (const chunk of d.stream) assert.equal(chunk.length, 4);
    }
    await pool.query(sql('04_descargas_biblioteca.sql'));
    assert.equal((await cuotas.consultar(lector)).descargas.consumidas, 2);
    assert.equal((await cuotas.consultar(autor)).descargas.consumidas, 0);
    await assert.rejects(casos.descargar(publica.id, lector), { codigo: 'CUOTA_DESCARGAS', message: 'Ya no tienes descargas disponibles en este ciclo.' });
    await assert.rejects(casos.descargar(privada.id, lector), { estado: 404 });
    await assert.rejects(casos.eliminar(publica.id, lector), { estado: 404 });
    await assert.rejects(casos.cambiarVisibilidad(publica.id, lector, false), { estado: 404 });
    await casos.cambiarVisibilidad(propia.id, lector, true);
    const gratis = await casos.descargar(propia.id, lector);
    await gratis.iniciar();
    for await (const chunk of gratis.stream) assert.equal(chunk.length, 4);
    assert.equal((await cuotas.consultar(lector)).descargas.consumidas, 2);
    // Revalidar la visibilidad si cambió mientras se abría el stream.
    const d = await casos.descargar(publica.id, autor);
    await d.iniciar();
    d.stream.destroy();
    const tercero = await usuario();
    const pendiente = await casos.descargar(publica.id, tercero);
    await casos.cambiarVisibilidad(publica.id, autor, false);
    await assert.rejects(pendiente.iniciar(), { estado: 404 });
    await pendiente.cancelar();
    pendiente.stream.destroy();
    assert.equal((await cuotas.consultar(tercero)).descargas.consumidas, 0);
  });
  await t.test('subida real exacta, rechazo por encima, aislamiento y eliminación', async () => {
    const u = await usuario(), otro = await usuario();
    await ocupar(u, 4999999996);
    const archivo = await casos.subir(u, dato(), false);
    assert.equal((await cuotas.consultar(u)).almacenamiento.usados_bytes, 5000000000);
    await assert.rejects(casos.subir(u, dato(1), false), { codigo: 'CUOTA_ALMACENAMIENTO' });
    await assert.rejects(casos.descargar(archivo.id, otro), { estado: 404 });
    await assert.rejects(casos.eliminar(archivo.id, otro), { estado: 404 });
    assert.equal((await cuotas.consultar(otro)).descargas.consumidas, 0);
    const metadata = await archivos.buscarPorIdYUsuario(archivo.id, u);
    const stat = await minio.statObject(bucket, metadata.nombre_objeto_minio);
    assert.equal(stat.size, 4);
    const response = await fetch(`http://127.0.0.1:${process.env.TEST_MINIO_PORT}/${bucket}/${metadata.nombre_objeto_minio}`);
    assert.equal(response.status, 403); // Bucket privado real.
    await casos.eliminar(archivo.id, u);
    assert.equal((await cuotas.consultar(u)).almacenamiento.usados_bytes, 4999999996);
  });
  await t.test('subidas simultáneas no exceden cuota y reservas cuentan', async () => {
    const u = await usuario();
    await ocupar(u, 4999999990);
    const resultado = await Promise.allSettled([casos.subir(u, dato(6), false), casos.subir(u, dato(6), false)]);
    assert.equal(resultado.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(resultado.find(r => r.status === 'rejected').reason.codigo, 'CUOTA_ALMACENAMIENTO');
    assert.equal((await cuotas.consultar(u)).almacenamiento.usados_bytes, 4999999996);
    const reserva = await cuotas.reservarSubida(u, `${u}/pendiente`, 4);
    assert.equal((await cuotas.consultar(u)).almacenamiento.disponibles_bytes, 0);
    await assert.rejects(cuotas.reservarSubida(u, `${u}/otra`, 1), { codigo: 'CUOTA_ALMACENAMIENTO' });
    await cuotas.compensarSubida(u, reserva);
    assert.equal((await cuotas.consultar(u)).almacenamiento.reservados_bytes, 0);
  });
  await t.test('fallo metadatos compensa MinIO; fallo limpieza conserva reserva hasta recuperación', async () => {
    const u = await usuario();
    const roto = { ...repo, conUsuario: (id, fn) => repo.conUsuario(id, tx => {
      tx.archivos.registrar = async () => { throw new Error('metadatos fallaron'); };
      return fn(tx);
    }) };
    let fallaLimpieza = false;
    const storage = { ...almacenamiento, eliminar: nombre => {
      if (fallaLimpieza) throw new Error('limpieza falló');
      return almacenamiento.eliminar(nombre);
    } };
    const q = crearCasosCuotas({ repo: roto, almacenamiento: storage });
    const c = crearCasosArchivos({ repositorio: archivos, almacenamiento: storage, cuotas: q, registrarError: () => {} });
    await assert.rejects(c.subir(u, dato(), false), /metadatos fallaron/);
    assert.equal((await cuotas.consultar(u)).almacenamiento.reservados_bytes, 0);
    fallaLimpieza = true;
    await assert.rejects(c.subir(u, dato(), false), /metadatos fallaron/);
    assert.equal((await cuotas.consultar(u)).almacenamiento.reservados_bytes, 4);
    await pool.query("UPDATE reservas_subida SET vence_en=now()-interval '1 minute' WHERE usuario_id=$1", [u]);
    assert.equal((await q.recuperarReservas()).fallos, 1);
    fallaLimpieza = false;
    await cuotas.recuperarReservas();
    await cuotas.recuperarReservas();
    assert.equal((await cuotas.consultar(u)).almacenamiento.reservados_bytes, 0);
    const objetos = [];
    for await (const o of minio.listObjectsV2(bucket, `${u}/`, true)) objetos.push(o);
    assert.equal(objetos.length, 0);
  });
  await t.test('descargas concurrentes: dos permitidas, devolución idempotente e ilimitadas', async () => {
    const u = await usuario();
    const a = await casos.subir(await usuario(), dato(), true);
    const rs = await Promise.allSettled(Array.from({ length: 8 }, () => cuotas.reservarDescarga(u, a.id)));
    assert.equal(rs.filter(r => r.status === 'fulfilled').length, 2);
    assert.ok(rs.filter(r => r.status === 'rejected').every(r => r.reason.codigo === 'CUOTA_DESCARGAS'));
    const r = rs.find(r => r.status === 'fulfilled').value;
    await cuotas.devolverDescarga(u, r.id);
    await cuotas.devolverDescarga(u, r.id);
    assert.equal((await cuotas.consultar(u)).descargas.consumidas, 1);
    await pool.query("UPDATE suscripciones SET plan_id=(SELECT id FROM planes WHERE nombre='Pro Developer') WHERE usuario_id=$1 AND estado='ACTIVA'", [u]);
    await Promise.all(Array.from({ length: 10 }, () => cuotas.reservarDescarga(u, a.id)));
    const info = await cuotas.consultar(u);
    assert.equal(info.descargas.consumidas, 11);
    assert.equal(info.descargas.restantes, null);
    assert.equal(info.alertas.descargas, null);
  });
  await t.test('abrir objeto inexistente no consume; reserva abandonada se recupera', async () => {
    const u = await usuario();
    const owner = await usuario();
    const a = await ocupar(owner, 4);
    await casos.cambiarVisibilidad(a.id, owner, true);
    await assert.rejects(casos.descargar(a.id, u));
    assert.equal((await cuotas.consultar(u)).descargas.consumidas, 0);
    const r = await cuotas.reservarDescarga(u, a.id);
    await pool.query("UPDATE reservas_descarga SET vence_en=now()-interval '1 minute' WHERE id=$1", [r.id]);
    await cuotas.recuperarReservas();
    assert.equal((await cuotas.consultar(u)).descargas.consumidas, 0);
  });
  await t.test('suscripción futura no da permisos antes de su inicio', async () => {
    const u = await usuario();
    await pool.query("UPDATE suscripciones SET plan_id=(SELECT id FROM planes WHERE nombre='Pro Developer'),fecha_inicio=now()+interval '1 month',fecha_fin=now()+interval '2 months' WHERE usuario_id=$1", [u]);
    assert.equal((await cuotas.consultar(u)).plan.nombre, 'Free');
    assert.equal((await pool.query("SELECT count(*) FROM suscripciones WHERE usuario_id=$1 AND estado='ACTIVA'", [u])).rows[0].count, '1');
    assert.equal((await pool.query("SELECT count(*) FROM suscripciones WHERE usuario_id=$1 AND estado='PENDIENTE'", [u])).rows[0].count, '1');
  });
  await t.test('recuperación no devuelve descargas ya iniciadas y respeta propietario', async () => {
    const u = await usuario(), otro = await usuario();
    const a = await casos.subir(await usuario(), dato(), true);
    const r = await cuotas.reservarDescarga(u, a.id);
    await cuotas.iniciarDescarga(u, r.id, a.id);
    await pool.query("UPDATE reservas_descarga SET vence_en=now()-interval '1 minute' WHERE id=$1", [r.id]);
    await cuotas.devolverDescarga(otro, r.id);
    await cuotas.recuperarReservas();
    assert.equal((await cuotas.consultar(u)).descargas.consumidas, 1);
    assert.equal((await cuotas.consultar(otro)).descargas.consumidas, 0);
  });
  await t.test('borrado incompleto conserva consumo; reintento completa sin objeto', async () => {
    const u = await usuario();
    const a = await casos.subir(u, dato(), false);
    const roto = { ...repo, conUsuario: (id, fn) => repo.conUsuario(id, tx => {
      tx.archivos.eliminarRegistro = async () => { throw new Error('borrado SQL falló'); };
      return fn(tx);
    }) };
    const c = crearCasosArchivos({ repositorio: archivos, almacenamiento, cuotas: crearCasosCuotas({ repo: roto, almacenamiento }) });
    await assert.rejects(c.eliminar(a.id, u), /borrado SQL falló/);
    assert.equal((await cuotas.consultar(u)).almacenamiento.usados_bytes, 4);
    await casos.eliminar(a.id, u);
    assert.equal((await cuotas.consultar(u)).almacenamiento.usados_bytes, 0);
  });
  await t.test('nuevo ciclo no resetea con login/consulta y devolución afecta ciclo original', async () => {
    const u = await usuario();
    const a = await casos.subir(await usuario(), dato(), true);
    const reserva = await cuotas.reservarDescarga(u, a.id);
    const antes = await cuotas.consultar(u);
    const futuro = new Date(antes.descargas.fin);
    const reloj = { ...repo, conUsuario: (id, fn) => repo.conUsuario(id, tx => { tx.ahora = futuro; return fn(tx); }) };
    const q = crearCasosCuotas({ repo: reloj, almacenamiento });
    assert.equal((await q.consultar(u)).descargas.consumidas, 0);
    assert.equal((await q.consultar(u)).descargas.consumidas, 0);
    await q.devolverDescarga(u, reserva.id);
    assert.equal((await q.consultar(u)).descargas.consumidas, 0);
    assert.equal((await pool.query('SELECT consumidas FROM ciclos_descargas WHERE usuario_id=$1 AND inicio=$2', [u, antes.descargas.inicio])).rows[0].consumidas, '0');
  });
});
