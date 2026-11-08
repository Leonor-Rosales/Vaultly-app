const { ErrorApp } = require('../domain/errores');
const fuentes = {
  archivo: {tabla:'archivos', nombre:'nombre_original', padre:'carpeta_id'},
  carpeta: {tabla:'carpetas', nombre:'nombre', padre:'carpeta_padre_id'},
};
function crearPapeleraRepositorio(pool) {
  async function transaccion(usuario, fn) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT id FROM usuarios WHERE id=$1 FOR NO KEY UPDATE', [usuario]);
      const resultado = await fn(db);
      await db.query('COMMIT');
      return resultado;
    } catch (e) {
      await db.query('ROLLBACK');
      if (e.code === '23505') throw new ErrorApp('Ya existe un elemento con ese nombre. Elige otro nombre.', 409);
      throw e;
    } finally { db.release(); }
  }
  async function enviar(usuario, tipo, id) {
    const {tabla,nombre,padre} = fuentes[tipo];
    return transaccion(usuario, async db => {
      if (tipo === 'carpeta') await db.query('SELECT id FROM carpetas WHERE usuario_id=$1 ORDER BY id FOR UPDATE', [usuario]);
      const {rows:[item]} = await db.query(`SELECT ${nombre} AS nombre, ${padre} AS padre FROM ${tabla}
        WHERE id=$1 AND usuario_id=$2 AND papelera_id IS NULL FOR UPDATE`, [id,usuario]);
      if (!item) throw new ErrorApp('Elemento no encontrado.',404);
      const {rows:[entrada]} = await db.query(`WITH RECURSIVE ruta AS (
        SELECT id, carpeta_padre_id, nombre::text AS camino FROM carpetas WHERE id=$4
        UNION ALL SELECT c.id,c.carpeta_padre_id,c.nombre || ' / ' || r.camino FROM carpetas c JOIN ruta r ON c.id=r.carpeta_padre_id)
        INSERT INTO papelera(usuario_id,tipo,elemento_id,padre_original,nombre,ubicacion)
        VALUES($1,$2,$3,$4,$5,'Mis archivos' || coalesce((SELECT ' / ' || camino FROM ruta WHERE carpeta_padre_id IS NULL),''))
        RETURNING id`, [usuario,tipo,id,item.padre,item.nombre]);
      if (tipo === 'carpeta') {
        await db.query(`WITH RECURSIVE arbol(id) AS (SELECT $1::uuid UNION ALL SELECT c.id FROM carpetas c JOIN arbol a ON c.carpeta_padre_id=a.id WHERE c.papelera_id IS NULL)
          UPDATE carpetas SET papelera_id=$2 WHERE id IN (SELECT id FROM arbol)`, [id,entrada.id]);
        await db.query('UPDATE archivos SET papelera_id=$1 WHERE papelera_id IS NULL AND carpeta_id IN (SELECT id FROM carpetas WHERE papelera_id=$1)', [entrada.id]);
      }
      await db.query(`UPDATE ${tabla} SET papelera_id=$2, ${padre}=NULL WHERE id=$1`, [id,entrada.id]);
      return entrada;
    });
  }
  async function listar(usuario) {
    const {rows} = await pool.query(`SELECT p.id,p.nombre,p.tipo,p.ubicacion,p.vence_en,a.id AS archivo_id,a.tipo_mime,
      (p.padre_original IS NOT NULL AND c.id IS NULL) AS destino_en_raiz,
      (SELECT coalesce(sum(tamanio_bytes),0) FROM archivos WHERE papelera_id=p.id)::text AS bytes
      FROM papelera p LEFT JOIN archivos a ON p.tipo='archivo' AND a.id=p.elemento_id AND a.papelera_id=p.id
      LEFT JOIN carpetas_activas c ON c.id=p.padre_original
      WHERE p.usuario_id=$1 ORDER BY p.enviado_en DESC,p.id`, [usuario]);
    return {items:rows, bytes:rows.reduce((s,r)=>s+BigInt(r.bytes),0n).toString()};
  }
  async function restaurar(usuario,id,nuevoNombre,aceptarRaiz) {
    return transaccion(usuario, async db => {
      const {rows:[p]} = await db.query('SELECT * FROM papelera WHERE id=$1 AND usuario_id=$2 AND vence_en>now() FOR UPDATE',[id,usuario]);
      if (!p) throw new ErrorApp('El elemento ya no se puede restaurar.',404);
      const {tabla,nombre,padre} = fuentes[p.tipo];
      const destino = p.padre_original && (await db.query('SELECT id FROM carpetas_activas WHERE id=$1 FOR SHARE',[p.padre_original])).rows[0]?.id;
      if (p.padre_original && !destino && !aceptarRaiz) throw new ErrorApp('La ubicación original ya no está disponible. Restaura en Mis archivos.',409);
      const valor = nuevoNombre ?? p.nombre;
      if (!valor.trim() || [...valor].length > (p.tipo === 'carpeta' ? 100 : 255) || /[\\/\x00-\x1f]/.test(valor)) throw new ErrorApp('Nombre inválido.',400);
      const repetido = await db.query(`SELECT 1 FROM ${tabla} WHERE usuario_id=$1 AND papelera_id IS NULL AND ${padre} IS NOT DISTINCT FROM $2 AND lower(btrim(${nombre}))=lower(btrim($3)) LIMIT 1`,[usuario,destino,valor]);
      if (repetido.rowCount) throw new ErrorApp('Ese nombre ya existe en el destino. Elige otro nombre.',409);
      await db.query(`UPDATE ${tabla} SET ${nombre}=$2,${padre}=$3 WHERE id=$1`,[p.elemento_id,valor.trim(),destino]);
      await db.query('UPDATE carpetas SET papelera_id=NULL WHERE papelera_id=$1',[id]);
      await db.query('UPDATE archivos SET papelera_id=NULL WHERE papelera_id=$1',[id]);
      await db.query('DELETE FROM papelera WHERE id=$1',[id]);
    });
  }
  async function purgar(usuario,id) {
    return transaccion(usuario, async db => {
      const entrada = await db.query('SELECT id FROM papelera WHERE id=$1 AND usuario_id=$2 FOR UPDATE',[id,usuario]);
      if (!entrada.rowCount) return;
      await db.query('INSERT INTO objetos_pendientes_borrado(objeto) SELECT nombre_objeto_minio FROM archivos WHERE papelera_id=$1 ON CONFLICT DO NOTHING',[id]);
      await db.query('DELETE FROM archivos WHERE papelera_id=$1',[id]);
      await db.query('UPDATE carpetas SET carpeta_padre_id=NULL WHERE papelera_id=$1',[id]);
      await db.query('DELETE FROM carpetas WHERE papelera_id=$1',[id]);
      await db.query('DELETE FROM papelera WHERE id=$1',[id]);
    });
  }
  return {enviar,listar,restaurar,purgar,
    vencidos: async () => (await pool.query('SELECT id,usuario_id FROM papelera WHERE vence_en<=now() ORDER BY vence_en LIMIT 100')).rows,
    pendientes: async () => (await pool.query(`UPDATE objetos_pendientes_borrado SET reintentar_en=now()+interval '1 minute'
      WHERE objeto IN (SELECT objeto FROM objetos_pendientes_borrado WHERE reintentar_en<=now() ORDER BY reintentar_en LIMIT 100 FOR UPDATE SKIP LOCKED) RETURNING objeto`)).rows,
    confirmarBorrado: objeto => pool.query('DELETE FROM objetos_pendientes_borrado WHERE objeto=$1',[objeto]),
  };
}
module.exports = {crearPapeleraRepositorio};
