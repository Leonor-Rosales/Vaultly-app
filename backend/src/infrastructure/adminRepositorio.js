const { ErrorApp } = require('../domain/errores');
const { fotoPlan } = require('../domain/auditoriaPlanes');
const campos = 'u.id, u.nombre_completo, u.correo_electronico, u.estado_cuenta, u.created_at';
function crearAdminRepositorio(pool) {
  return {
    async listarAuditoria({ pagina, accion, q, desde: fechaDesde = '', hasta = '' }) {
      const responsable = "CASE WHEN a.detalles_json->>'origen'='LIMPIEZA_AUTOMATICA' THEN 'Sistema automático' ELSE COALESCE(u.nombre_completo,'Administrador eliminado') END";
      const filtro = `a.modulo_afectado IN ('planes','administradores') AND ($1='' OR t.codigo=$1)
        AND ($2='' OR (${responsable}) ILIKE '%'||$2||'%' OR a.detalles_json->'nuevo'->>'nombre' ILIKE '%'||$2||'%' OR a.detalles_json->'anterior'->>'nombre' ILIKE '%'||$2||'%' OR a.detalles_json->'nuevo'->>'nombre_completo' ILIKE '%'||$2||'%')
        AND ($3::date IS NULL OR a.fecha_hora >= ($3::date::timestamp AT TIME ZONE 'America/Guatemala'))
        AND ($4::date IS NULL OR a.fecha_hora < (($4::date + 1)::timestamp AT TIME ZONE 'America/Guatemala'))`;
      const desde = 'FROM auditoria a JOIN tipos_accion t ON t.id=a.tipo_accion_id LEFT JOIN usuarios u ON u.id=a.usuario_id';
      const args = [accion, q, fechaDesde || null, hasta || null];
      const total = Number((await pool.query(`SELECT count(*) AS total ${desde} WHERE ${filtro}`, args)).rows[0].total);
      const { rows } = await pool.query(`SELECT a.id::text,a.usuario_id,a.fecha_hora,a.modulo_afectado,a.detalles_json,t.codigo,
        ${responsable} AS administrador ${desde} WHERE ${filtro}
        ORDER BY a.fecha_hora DESC,a.id DESC LIMIT 25 OFFSET $5`, [...args, (pagina - 1) * 25]);
      return { items: rows, total, pagina, por_pagina: 25 };
    },
    async listarPagos() {
      const resultado = await pool.query(`
        SELECT p.id, u.nombre_completo, u.correo_electronico, p.plan_nombre,
               p.monto, p.estado, p.creado_en
        FROM pagos p JOIN usuarios u ON u.id = p.usuario_id
        ORDER BY p.creado_en DESC, p.id DESC
      `);
      return resultado.rows;
    },
    listarPlanes: async () => (await pool.query(`SELECT p.*, p.inactivo_desde + interval '720 hours' AS retiro_desde,
      EXISTS(SELECT 1 FROM suscripciones s WHERE s.plan_id=p.id) AS tiene_suscripciones,
      (EXISTS(SELECT 1 FROM suscripciones s WHERE s.plan_id=p.id) OR EXISTS(SELECT 1 FROM pagos pg WHERE pg.plan_id=p.id)) AS tiene_historial,
      (SELECT count(*)::int FROM suscripciones s
      WHERE s.plan_id=p.id AND s.estado='ACTIVA' AND s.fecha_inicio<=now() AND s.fecha_fin>now()) AS suscripciones_vigentes
      FROM planes p WHERE p.archivado_en IS NULL ORDER BY p.precio_mensual,p.id`)).rows,
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
          encolarAvisosRetiro: plan => c.query(`INSERT INTO correos_retiro_planes(plan_id,version_plan,usuario_id,suscripcion_id,retirado_en)
            SELECT DISTINCT ON (s.usuario_id) p.id,p.version,s.usuario_id,s.id,p.inactivo_desde
            FROM suscripciones s JOIN planes p ON p.id=s.plan_id
            WHERE p.id=$1 AND s.estado IN ('ACTIVA','PENDIENTE') AND s.fecha_fin>clock_timestamp()
            ORDER BY s.usuario_id,s.fecha_fin DESC,s.id
            ON CONFLICT(plan_id,version_plan,usuario_id) DO NOTHING`, [plan.id]),
          guardarPlan: (id, d, version) => {
            const v = [d.nombre, d.precio_mensual, d.cuota_storage_gb, d.limite_descargas, d.permite_carpetas_publicas, d.activo, d.promocion_precio, d.promocion_inicio, d.promocion_fin, d.promocion_tipo, d.promocion_porcentaje];
            return id ? one('UPDATE planes SET nombre=$1, precio_mensual=$2, cuota_storage_gb=$3, limite_descargas=$4, permite_carpetas_publicas=$5, activo=$6, promocion_precio=$7,promocion_inicio=$8,promocion_fin=$9,promocion_tipo=$10,promocion_porcentaje=$11 WHERE id=$12 AND version=$13 RETURNING *', [...v, id, version])
              : one('INSERT INTO planes(nombre, precio_mensual, cuota_storage_gb, limite_descargas, permite_carpetas_publicas, activo,promocion_precio,promocion_inicio,promocion_fin,promocion_tipo,promocion_porcentaje) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', v);
          },
          auditarPlan: (actor, accion, anterior, nuevo) => {
            return c.query(`INSERT INTO auditoria(usuario_id,tipo_accion_id,modulo_afectado,detalles_json)
              VALUES($1,(SELECT id FROM tipos_accion WHERE codigo=$2),'planes',$3)`,
              [actor, accion, { plan_id: nuevo.id, anterior: fotoPlan(anterior), nuevo: fotoPlan(nuevo) }]);
          },
          auditarAdministrador: (actor, accion, anterior, nuevo) => {
            const foto = p => p ? Object.fromEntries(['id','nombre_completo','correo_electronico','estado_cuenta'].map(k => [k, p[k]])) : null;
            return c.query(`INSERT INTO auditoria(usuario_id,tipo_accion_id,modulo_afectado,detalles_json)
              VALUES($1,(SELECT id FROM tipos_accion WHERE codigo=$2),'administradores',$3)`,
              [actor, accion, { administrador_id: nuevo.id, anterior: foto(anterior), nuevo: foto(nuevo) }]);
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
