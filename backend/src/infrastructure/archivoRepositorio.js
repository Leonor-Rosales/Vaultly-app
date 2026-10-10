
const pool = require('./db');

async function listarPorUsuario(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, nombre_original, tamanio_bytes, tipo_mime,
            es_publica, carpeta_id, created_at
     FROM archivos
     WHERE usuario_id = $1
     ORDER BY created_at DESC`,
    [usuarioId]
  );

  return rows;
}

async function buscarPorIdYUsuario(id, usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, usuario_id, nombre_original, nombre_objeto_minio,
            ruta_minio, tamanio_bytes, tipo_mime, es_publica,
            carpeta_id, created_at
     FROM archivos
     WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );

  return rows[0] || null;
}


async function registrar({
  usuarioId,
  nombreOriginal,
  nombreObjeto,
  rutaMinio,
  tamanioBytes,
  tipoMime,
  carpetaId = null,
  esPublica = false,
}) {
  const { rows } = await pool.query(
    `INSERT INTO archivos (
       usuario_id, carpeta_id, nombre_original,
       nombre_objeto_minio, ruta_minio, tamanio_bytes,
       tipo_mime, es_publica
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, nombre_original, tamanio_bytes, tipo_mime,
               es_publica, carpeta_id, created_at`,
    [
      usuarioId,
      carpetaId,
      nombreOriginal,
      nombreObjeto,
      rutaMinio,
      tamanioBytes,
      tipoMime,
      esPublica,
    ]
  );

  return rows[0];
}


async function eliminarRegistro(id, usuarioId) {
  const { rows } = await pool.query(
    `DELETE FROM archivos
     WHERE id = $1 AND usuario_id = $2
     RETURNING id`,
    [id, usuarioId]
  );

  return rows[0] || null;
}


async function actualizarVisibilidad(id, usuarioId, esPublica) {
  const { rows } = await pool.query(
    `UPDATE archivos
     SET es_publica = $3
     WHERE id = $1 AND usuario_id = $2
     RETURNING id, nombre_original, tamanio_bytes, tipo_mime,
               es_publica, carpeta_id, created_at`,
    [id, usuarioId, esPublica]
  );

  return rows[0] || null;
}


module.exports = {
  listarPorUsuario,
  buscarPorIdYUsuario,
  registrar,
  eliminarRegistro,
  actualizarVisibilidad,
};
