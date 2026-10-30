function crearCuentaRepositorio(pool) {
  return {
    async guardarNombre(id, nombre) {
      const { rows } = await pool.query(`UPDATE usuarios u SET nombre_completo=$2 FROM roles r
        WHERE u.id=$1 AND u.rol_id=r.id AND u.estado_cuenta='ACTIVO' AND r.nombre IN ('CLIENTE','ADMIN')
        RETURNING u.id,u.nombre_completo,u.correo_electronico,r.nombre AS rol`, [id, nombre]);
      return rows[0] || null;
    },
  };
}
module.exports = { crearCuentaRepositorio };
