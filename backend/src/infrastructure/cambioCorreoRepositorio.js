const { ErrorApp } = require('../domain/errores');
function crearCambioCorreoRepositorio(pool) {
  return {
    async conUsuario(id, fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query("SET LOCAL lock_timeout='10s'");
        const one = async (sql, values = []) => (await c.query(sql, values)).rows[0];
        const usuario = await one(`SELECT u.*, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 FOR UPDATE OF u`, [id]);
        if (!usuario || usuario.rol !== 'ADMIN' || usuario.estado_cuenta !== 'ACTIVO') throw new ErrorApp('No tienes permiso para esta acción', 403);
        await c.query('INSERT INTO cambios_correo(usuario_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
        const solicitud = await one('SELECT * FROM cambios_correo WHERE usuario_id=$1 FOR UPDATE', [id]);
        const { ahora } = await one('SELECT clock_timestamp() AS ahora');
        const result = await fn({ usuario, solicitud, ahora,
          ocupado: async correo => !!(await one('SELECT 1 FROM usuarios WHERE lower(btrim(correo_electronico))=$1 AND id<>$2', [correo, id])),
          guardar: s => c.query(`UPDATE cambios_correo SET solicitud_id=$2,correo_anterior=$3,correo_nuevo=$4,codigo_hash=$5,estado=$6,vence_en=$7,reenviar_desde=$8,intentos=$9,ventana_envios=$10,envios=$11,ventana_password=$12,fallos_password=$13 WHERE usuario_id=$1`,
            [id, s.solicitud_id, s.correo_anterior, s.correo_nuevo, s.codigo_hash, s.estado, s.vence_en, s.reenviar_desde, s.intentos, s.ventana_envios, s.envios, s.ventana_password, s.fallos_password]),
          cambiarCorreo: correo => one(`UPDATE usuarios SET correo_electronico=$2,correo_actualizado_en=clock_timestamp() WHERE id=$1 RETURNING id,nombre_completo,correo_electronico`, [id, correo]),
        });
        await c.query('COMMIT');
        return result;
      } catch (e) {
        await c.query('ROLLBACK');
        if (e.code === '23505') throw new ErrorApp('Ese correo ya está registrado', 409, 'CORREO_OCUPADO');
        if (e.code === '55P03' || e.code === '40P01') throw new ErrorApp('Otra operación está en curso. Inténtalo de nuevo.', 409);
        throw e;
      } finally { c.release(); }
    },
  };
}
module.exports = { crearCambioCorreoRepositorio };
