const { ErrorApp } = require('../domain/errores');

/**
 * Repositorio de pagos simulados. Usa el mismo bloqueo por usuario (SELECT ... FOR UPDATE
 * sobre usuarios) que cuotasRepositorio, así contratar un plan no corre en paralelo con
 * subidas o descargas del mismo usuario.
 */
function crearPagosRepositorio(pool) {
  return {
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
          plan: (id) => one('SELECT * FROM planes WHERE id=$1 AND activo', [id]),
          activa: () => one("SELECT * FROM suscripciones WHERE usuario_id=$1 AND estado='ACTIVA'", [usuarioId]),
          cerrarSuscripcion: (id) => client.query(
            "UPDATE suscripciones SET estado='VENCIDA' WHERE id=$1 AND usuario_id=$2", [id, usuarioId]),
          crearSuscripcion: (planId, inicio, fin) => one(`INSERT INTO suscripciones(usuario_id,plan_id,fecha_inicio,fecha_fin,estado)
            VALUES($1,$2,$3,$4,'ACTIVA') RETURNING *`, [usuarioId, planId, inicio, fin]),
          usados: async () => Number((await one('SELECT COALESCE(SUM(tamanio_bytes),0) AS n FROM archivos WHERE usuario_id=$1', [usuarioId])).n),
          reservados: async () => Number((await one('SELECT COALESCE(SUM(bytes),0) AS n FROM reservas_subida WHERE usuario_id=$1', [usuarioId])).n),
          registrarPago: (p) => one(`INSERT INTO pagos(id,usuario_id,plan_id,plan_nombre,monto,metodo,estado,codigo,creado_en)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [p.id, usuarioId, p.planId, p.planNombre, p.monto, p.metodo, p.estado, p.codigo, p.fecha]),
          listarPagos: async () => (await client.query(
            'SELECT * FROM pagos WHERE usuario_id=$1 ORDER BY creado_en DESC, id LIMIT 200', [usuarioId])).rows,
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
module.exports = { crearPagosRepositorio };
