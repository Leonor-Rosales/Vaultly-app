const { fotoPlan } = require('../domain/auditoriaPlanes');

// Sin endpoint público ni parámetros de fecha: solo usa el reloj de PostgreSQL.
async function limpiarPlanesInactivos(pool) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [bloqueo] } = await c.query('SELECT pg_try_advisory_xact_lock(7102033) AS obtenido');
    if (!bloqueo.obtenido) { await c.query('COMMIT'); return { omitida: true, archivados: 0, eliminados: 0 }; }
    await c.query("SET LOCAL lock_timeout = '10s'");
    // Mismo orden de bloqueo que administración. Coordina compras y reactivaciones.
    await c.query('LOCK TABLE usuarios IN EXCLUSIVE MODE');
    await c.query('LOCK TABLE suscripciones IN SHARE ROW EXCLUSIVE MODE');
    const { rows: [{ ahora }] } = await c.query('SELECT clock_timestamp() AS ahora');
    const { rows: planes } = await c.query(`SELECT p.* FROM planes p
      WHERE NOT p.activo AND p.nombre<>'Free' AND p.archivado_en IS NULL
        AND p.inactivo_desde <= $1::timestamptz - interval '720 hours'
        AND NOT EXISTS (SELECT 1 FROM suscripciones s WHERE s.plan_id=p.id
          AND s.estado IN ('ACTIVA','PENDIENTE') AND s.fecha_fin>$1)
      ORDER BY p.inactivo_desde,p.id LIMIT 100 FOR UPDATE OF p`, [ahora]);
    const resultado = { omitida: false, archivados: 0, eliminados: 0 };
    for (const plan of planes) {
      const { rows: [{ historial }] } = await c.query(`SELECT EXISTS(SELECT 1 FROM suscripciones WHERE plan_id=$1)
        OR EXISTS(SELECT 1 FROM pagos WHERE plan_id=$1) AS historial`, [plan.id]);
      let nuevo = null;
      if (historial) {
        nuevo = (await c.query('UPDATE planes SET archivado_en=$2 WHERE id=$1 RETURNING *', [plan.id,ahora])).rows[0];
        resultado.archivados++;
      } else {
        await c.query('DELETE FROM planes WHERE id=$1', [plan.id]);
        resultado.eliminados++;
      }
      await c.query(`INSERT INTO auditoria(usuario_id,tipo_accion_id,modulo_afectado,detalles_json)
        VALUES(NULL,(SELECT id FROM tipos_accion WHERE codigo=$1),'planes',$2)`,
        [historial ? 'PLAN_ARCHIVADO' : 'PLAN_ELIMINADO', { origen:'LIMPIEZA_AUTOMATICA', plan_id:plan.id, dias_inactivo:30, anterior:fotoPlan(plan), nuevo:fotoPlan(nuevo) }]);
    }
    await c.query('COMMIT');
    return resultado;
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
module.exports = { limpiarPlanesInactivos };
