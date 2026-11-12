// Cola transaccional: nunca enviar SMTP dentro de guardarPlan ni antes de su COMMIT.
async function enviarAvisosRetiro(pool, enviar) {
  const resultado = { enviados: 0, cancelados: 0, fallos: 0 };
  for (let i = 0; i < 20; i++) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const { rows: [aviso] } = await c.query(`SELECT n.id,n.intentos,u.correo_electronico,u.nombre_completo,p.nombre,s.fecha_fin,
        (NOT p.activo AND p.inactivo_desde=n.retirado_en AND s.plan_id=p.id
          AND s.estado IN ('ACTIVA','PENDIENTE') AND s.fecha_fin>clock_timestamp()) AS vigente
        FROM correos_retiro_planes n JOIN planes p ON p.id=n.plan_id
        JOIN usuarios u ON u.id=n.usuario_id JOIN suscripciones s ON s.id=n.suscripcion_id
        WHERE n.estado='PENDIENTE' AND n.proximo_intento<=clock_timestamp()
        ORDER BY n.proximo_intento,n.id LIMIT 1 FOR UPDATE OF n SKIP LOCKED`);
      if (!aviso) { await c.query('COMMIT'); break; }
      if (!aviso.vigente) {
        await c.query("UPDATE correos_retiro_planes SET estado='CANCELADO' WHERE id=$1", [aviso.id]);
        resultado.cancelados++;
      } else {
        try {
          await enviar({ id: aviso.id, para: aviso.correo_electronico, nombre: aviso.nombre_completo, plan: aviso.nombre, fechaFin: aviso.fecha_fin });
          await c.query("UPDATE correos_retiro_planes SET estado='ENVIADO',enviado_en=clock_timestamp(),intentos=intentos+1 WHERE id=$1", [aviso.id]);
          resultado.enviados++;
        } catch {
          await c.query("UPDATE correos_retiro_planes SET intentos=intentos+1,proximo_intento=clock_timestamp()+$2*interval '1 second' WHERE id=$1", [aviso.id, Math.min(3600, 60 * 2 ** Math.min(aviso.intentos, 6))]);
          resultado.fallos++;
        }
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; }
    finally { c.release(); }
  }
  return resultado;
}
module.exports = { enviarAvisosRetiro };
