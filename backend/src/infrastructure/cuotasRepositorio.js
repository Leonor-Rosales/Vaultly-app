const { ErrorApp } = require('../domain/errores');
const { crearArchivoRepositorio } = require('./archivoRepositorio');

function crearCuotasRepositorio(pool) {
  return {
    listarPlanes: async () => (await pool.query('SELECT * FROM planes WHERE activo ORDER BY precio_mensual, id')).rows,
    usuariosConReservasVencidas: async () => (await pool.query(`
      SELECT usuario_id FROM reservas_subida WHERE vence_en <= clock_timestamp()
      UNION SELECT usuario_id FROM reservas_descarga WHERE estado='RESERVADA' AND vence_en <= clock_timestamp()`)).rows.map(r => r.usuario_id),
    async conUsuario(usuarioId, fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '30s'");
        const existe = await client.query('SELECT id FROM usuarios WHERE id=$1 FOR UPDATE', [usuarioId]);
        if (!existe.rowCount) throw new ErrorApp('Usuario no encontrado', 404);
        const { rows: [tiempo] } = await client.query('SELECT clock_timestamp() AS ahora');
        const one = async (sql, values = []) => (await client.query(sql, values)).rows[0] || null;
        const tx = {
          ahora: tiempo.ahora,
          archivos: crearArchivoRepositorio(client),
          activa: () => one(`SELECT s.*, p.nombre, p.cuota_storage_gb, p.limite_descargas, p.precio_mensual
            FROM suscripciones s JOIN planes p ON p.id=s.plan_id WHERE s.usuario_id=$1 AND s.estado='ACTIVA'`, [usuarioId]),
          free: () => one("SELECT * FROM planes WHERE nombre='Free' AND activo"),
          cerrarSuscripcion: (id, estado) => client.query('UPDATE suscripciones SET estado=$2 WHERE id=$1 AND usuario_id=$3', [id, estado, usuarioId]),
          crearFree: (planId, inicio, fin) => one(`INSERT INTO suscripciones(usuario_id,plan_id,fecha_inicio,fecha_fin,estado)
            VALUES($1,$2,$3,$4,'ACTIVA') RETURNING *`, [usuarioId, planId, inicio, fin]),
          async ciclo(inicio, fin) {
            await client.query('INSERT INTO ciclos_descargas(usuario_id,inicio,fin) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [usuarioId, inicio, fin]);
            return one('SELECT * FROM ciclos_descargas WHERE usuario_id=$1 AND inicio=$2', [usuarioId, inicio]);
          },
          usados: async () => Number((await one('SELECT COALESCE(SUM(tamanio_bytes),0) AS n FROM archivos WHERE usuario_id=$1', [usuarioId])).n),
          reservados: async () => Number((await one('SELECT COALESCE(SUM(bytes),0) AS n FROM reservas_subida WHERE usuario_id=$1', [usuarioId])).n),
          reservarSubida: (r) => client.query('INSERT INTO reservas_subida(id,usuario_id,nombre_objeto,bytes,vence_en) VALUES($1,$2,$3,$4,$5)', [r.id, usuarioId, r.nombreObjeto, r.bytes, r.vence]),
          subida: (id) => one('SELECT * FROM reservas_subida WHERE id=$1 AND usuario_id=$2', [id, usuarioId]),
          borrarSubida: (id) => client.query('DELETE FROM reservas_subida WHERE id=$1 AND usuario_id=$2', [id, usuarioId]),
          vencidasSubida: async () => (await client.query('SELECT * FROM reservas_subida WHERE usuario_id=$1 AND vence_en <= $2', [usuarioId, tiempo.ahora])).rows,
          async reservarDescarga(id, ciclo, vence) {
            await client.query('UPDATE ciclos_descargas SET consumidas=consumidas+1 WHERE usuario_id=$1 AND inicio=$2', [usuarioId, ciclo]);
            await client.query('INSERT INTO reservas_descarga(id,usuario_id,ciclo_inicio,vence_en) VALUES($1,$2,$3,$4)', [id, usuarioId, ciclo, vence]);
          },
          descarga: (id) => one('SELECT * FROM reservas_descarga WHERE id=$1 AND usuario_id=$2', [id, usuarioId]),
          iniciarDescarga: (id) => client.query("UPDATE reservas_descarga SET estado='CONSUMIDA' WHERE id=$1 AND usuario_id=$2", [id, usuarioId]),
          async devolverDescarga(id) {
            const r = await one('DELETE FROM reservas_descarga WHERE id=$1 AND usuario_id=$2 RETURNING ciclo_inicio', [id, usuarioId]);
            if (r) await client.query('UPDATE ciclos_descargas SET consumidas=consumidas-1 WHERE usuario_id=$1 AND inicio=$2', [usuarioId, r.ciclo_inicio]);
          },
          vencidasDescarga: async () => (await client.query("SELECT * FROM reservas_descarga WHERE usuario_id=$1 AND estado='RESERVADA' AND vence_en <= $2", [usuarioId, tiempo.ahora])).rows,
        };
        const resultado = await fn(tx);
        await client.query('COMMIT');
        return resultado;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
  };
}
module.exports = { crearCuotasRepositorio };
