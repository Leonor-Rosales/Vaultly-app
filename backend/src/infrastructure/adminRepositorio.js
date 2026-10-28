const { ErrorApp } = require('../domain/errores');
const campos = 'u.id, u.nombre_completo, u.correo_electronico, u.estado_cuenta, u.created_at';
function crearAdminRepositorio(pool) {
  return {
    listarPlanes: async () => (await pool.query('SELECT * FROM planes ORDER BY precio_mensual, id')).rows,
    listarAdministradores: async () => (await pool.query(`SELECT ${campos} FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE r.nombre='ADMIN' ORDER BY u.nombre_completo, u.id`)).rows,
    async transaccion(tipo, fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query("SET LOCAL lock_timeout = '10s'");
        // Orden fijo; serializa administradores y altas de suscripciones frente a cambios del catálogo.
        await c.query('LOCK TABLE usuarios IN EXCLUSIVE MODE');
        if (tipo === 'plan') await c.query('LOCK TABLE suscripciones IN SHARE ROW EXCLUSIVE MODE');
        const one = async (sql, args = []) => (await c.query(sql, args)).rows[0];
        const tx = {
          actor: id => one(`SELECT u.estado_cuenta, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1`, [id]),
          plan: id => one('SELECT * FROM planes WHERE id=$1 FOR UPDATE', [id]),
          usado: async id => !!(await one('SELECT 1 FROM suscripciones WHERE plan_id=$1 LIMIT 1', [id])),
          guardarPlan: (id, d) => {
            const v = [d.nombre, d.precio_mensual, d.cuota_storage_gb, d.limite_descargas, d.permite_carpetas_publicas, d.activo];
            return id ? one('UPDATE planes SET nombre=$1, precio_mensual=$2, cuota_storage_gb=$3, limite_descargas=$4, permite_carpetas_publicas=$5, activo=$6 WHERE id=$7 RETURNING *', [...v, id])
              : one('INSERT INTO planes(nombre, precio_mensual, cuota_storage_gb, limite_descargas, permite_carpetas_publicas, activo) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', v);
          },
          administrador: id => one(`SELECT ${campos} FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 AND r.nombre='ADMIN'`, [id]),
          activos: async () => Number((await one("SELECT count(*) AS n FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE r.nombre='ADMIN' AND u.estado_cuenta='ACTIVO'")).n),
          guardarAdministrador: (id, d, hash) => id
            ? one(`UPDATE usuarios u SET nombre_completo=$1, correo_electronico=$2, estado_cuenta=$3 WHERE id=$4 RETURNING ${campos}`, [d.nombre_completo, d.correo_electronico, d.estado_cuenta, id])
            : one(`INSERT INTO usuarios AS u(rol_id,nombre_completo,correo_electronico,estado_cuenta,password_hash) VALUES((SELECT id FROM roles WHERE nombre='ADMIN'),$1,$2,$3,$4) RETURNING ${campos}`, [d.nombre_completo, d.correo_electronico, d.estado_cuenta, hash]),
        };
        const result = await fn(tx);
        await c.query('COMMIT');
        return result;
      } catch (e) {
        await c.query('ROLLBACK');
        if (e.code === '23505') throw new ErrorApp('El nombre del plan o correo ya está registrado', 409);
        if (e.code === '55P03') throw new ErrorApp('Otra operación está en curso. Inténtalo de nuevo.', 409);
        throw e;
      } finally { c.release(); }
    },
  };
}
module.exports = { crearAdminRepositorio };
