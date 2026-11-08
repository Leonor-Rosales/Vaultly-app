// Ejecutar desde backend contra una base local migrada. Los datos de prueba se revierten.
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const pool = require('../../src/infrastructure/db');
const {crearPapeleraRepositorio} = require('../../src/infrastructure/papeleraRepositorio');
const {crearArchivoRepositorio} = require('../../src/infrastructure/archivoRepositorio');

test('plazos independientes, acceso público, cuota, restauración y purga', async () => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const query = db.query.bind(db);
    const repo = crearPapeleraRepositorio({query, connect: async () => ({
      query: (sql, args) => query(({BEGIN:'SAVEPOINT accion', COMMIT:'RELEASE SAVEPOINT accion', ROLLBACK:'ROLLBACK TO SAVEPOINT accion'})[sql] || sql, args),
      release() {},
    })});
    const usuario = randomUUID();
    await query("INSERT INTO usuarios(id,rol_id,nombre_completo,correo_electronico,password_hash) SELECT $1,id,'Prueba papelera',$2,'prueba' FROM roles WHERE nombre='CLIENTE'",[usuario,usuario+'@example.test']);
    const carpeta = randomUUID();
    await query("INSERT INTO carpetas(id,usuario_id,nombre) VALUES($1,$2,'Origen')",[carpeta,usuario]);
    async function archivo() {
      const id = randomUUID();
      await query("INSERT INTO archivos(id,usuario_id,carpeta_id,nombre_original,nombre_objeto_minio,ruta_minio,tamanio_bytes,tipo_mime,es_publica) VALUES($1,$2,$3,'Prueba.txt',$4,$4,20,'text/plain',true)",[id,usuario,carpeta,id]);
      return id;
    }
    const primero = await archivo();
    const segundo = await archivo();
    const separado = await repo.enviar(usuario,'archivo',primero);
    const archivos = crearArchivoRepositorio(db);
    assert.ok(await archivos.buscarParaVistaPrevia(primero,usuario));
    assert.equal(await archivos.buscarParaVistaPrevia(primero,randomUUID()),null);
    assert.equal(await archivos.buscarDescargable(primero,usuario),null);
    assert.equal((await repo.listar(usuario)).items[0].archivo_id,primero);
    const grupo = await repo.enviar(usuario,'carpeta',carpeta);
    assert.equal((await repo.listar(usuario)).bytes,'40');
    assert.equal((await repo.listar(usuario)).items.length,2);
    assert.equal(await crearArchivoRepositorio(db).buscarDescargable(segundo, randomUUID()),null);
    await assert.rejects(repo.restaurar(usuario,separado.id), {estado:409});
    await repo.restaurar(usuario,grupo.id);
    await assert.rejects(repo.restaurar(usuario,separado.id), {estado:409});
    await repo.restaurar(usuario,separado.id,'Restaurado.txt');
    assert.equal((await repo.listar(usuario)).bytes,'0');
    const nueva = await repo.enviar(usuario,'carpeta',carpeta);
    await query("UPDATE papelera SET vence_en=now()-interval '1 second' WHERE id=$1",[nueva.id]);
    assert.equal(await archivos.buscarParaVistaPrevia(primero,usuario),null);
    await assert.rejects(repo.restaurar(usuario,nueva.id),{estado:404});
    assert.ok((await repo.vencidos()).some(p=>p.id===nueva.id));
    await repo.purgar(usuario,nueva.id);
    assert.equal((await query('SELECT count(*) AS n FROM archivos WHERE usuario_id=$1',[usuario])).rows[0].n,'0');
    assert.equal((await query('SELECT objeto FROM objetos_pendientes_borrado WHERE objeto IN ($1,$2)',[primero,segundo])).rowCount,2);
  } finally { await db.query('ROLLBACK'); db.release(); await pool.end(); }
});
