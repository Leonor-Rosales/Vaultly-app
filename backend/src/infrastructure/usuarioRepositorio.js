const pool = require('./db');

async function buscarRolPorNombre(nombre) {
  const { rows } = await pool.query('SELECT id, nombre FROM roles WHERE nombre = $1', [nombre]);
  return rows[0] || null;
}

async function crearUsuario({ id, rolId, nombreCompleto, correo, passwordHash, estado }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (id, rol_id, nombre_completo, correo_electronico, password_hash, estado_cuenta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nombre_completo, correo_electronico`,
    [id, rolId, nombreCompleto, correo, passwordHash, estado]
  );
  return rows[0];
}

async function buscarPorCorreoConRol(correo) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre_completo, u.correo_electronico, u.password_hash,
            u.estado_cuenta, r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.correo_electronico = $1`,
    [correo]
  );
  return rows[0] || null;
}

async function buscarPorIdConRol(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre_completo, u.correo_electronico, r.nombre AS rol
     FROM usuarios u JOIN roles r ON r.id = u.rol_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Pasa la cuenta de pendiente a activa. Devuelve true si cambió algo.
async function activarSiPendiente(id, estadoActivo, estadoPendiente) {
  const r = await pool.query(
    `UPDATE usuarios SET estado_cuenta = $2
     WHERE id = $1 AND estado_cuenta = $3
     RETURNING id`,
    [id, estadoActivo, estadoPendiente]
  );
  return r.rowCount > 0;
}

async function obtenerEstado(id) {
  const { rows } = await pool.query('SELECT estado_cuenta FROM usuarios WHERE id = $1', [id]);
  return rows[0] ? rows[0].estado_cuenta : null;
}

async function buscarPendientePorCorreo(correo, estadoPendiente) {
  const { rows } = await pool.query(
    `SELECT id, nombre_completo, correo_electronico
     FROM usuarios WHERE correo_electronico = $1 AND estado_cuenta = $2`,
    [correo, estadoPendiente]
  );
  return rows[0] || null;
}

module.exports = {
  buscarRolPorNombre,
  crearUsuario,
  buscarPorCorreoConRol,
  buscarPorIdConRol,
  activarSiPendiente,
  obtenerEstado,
  buscarPendientePorCorreo,
};
