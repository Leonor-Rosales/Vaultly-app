function crearVistaPreviaRepositorio(pool) {
  return {
    async consultar(id) {
      return (await pool.query('SELECT estado FROM vistas_previas WHERE archivo_id=$1', [id])).rows[0];
    },
    async reintentar(id) {
      await pool.query(`UPDATE vistas_previas SET estado='PENDIENTE',intentos=0,disponible_en=now(),actualizado_en=now()
        WHERE archivo_id=$1 AND estado='FALLIDA' AND actualizado_en < now() - interval '1 minute'`, [id]);
    },
    async trabajar(fn) {
      const db = await pool.connect();
      let bloqueado = false;
      try {
        // Un conversor activo entre todas las instancias. El cierre de sesión libera el bloqueo.
        bloqueado = (await db.query('SELECT pg_try_advisory_lock(7102030) AS obtenido')).rows[0].obtenido;
        if (!bloqueado) return;
        const trabajo = (await db.query(`SELECT v.*,a.nombre_original,a.tipo_mime,a.nombre_objeto_minio
          FROM vistas_previas v LEFT JOIN archivos a ON a.id=v.archivo_id
          WHERE (v.archivo_id IS NULL OR v.estado IN ('PENDIENTE','PROCESANDO')) AND v.disponible_en <= now()
          ORDER BY (v.archivo_id IS NULL) DESC, v.disponible_en LIMIT 1`)).rows[0];
        if (!trabajo) return;
        await fn(trabajo, {
          iniciar: () => db.query(`UPDATE vistas_previas SET estado='PROCESANDO',intentos=intentos+1,actualizado_en=now() WHERE id=$1`, [trabajo.id]),
          completar: () => db.query(`UPDATE vistas_previas SET estado='LISTA',actualizado_en=now() WHERE id=$1 AND archivo_id IS NOT NULL`, [trabajo.id]),
          fallar: () => db.query(`UPDATE vistas_previas SET estado=CASE WHEN intentos >= 3 THEN 'FALLIDA' ELSE 'PENDIENTE' END,
            disponible_en=now()+interval '30 seconds',actualizado_en=now() WHERE id=$1`, [trabajo.id]),
          eliminar: () => db.query('DELETE FROM vistas_previas WHERE id=$1', [trabajo.id]),
          posponerLimpieza: () => db.query("UPDATE vistas_previas SET disponible_en=now()+interval '30 seconds' WHERE id=$1", [trabajo.id]),
        });
      } finally {
        let descartar = false;
        if (bloqueado) {
          try { await db.query('SELECT pg_advisory_unlock(7102030)'); }
          catch { descartar = true; }
        }
        db.release(descartar);
      }
    },
  };
}
module.exports = { crearVistaPreviaRepositorio };
