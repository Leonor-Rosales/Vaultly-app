
function crearArchivoRepositorio(pool, enTransaccion = false) {
async function conTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(crearArchivoRepositorio(client, true), client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
async function conEtiquetas(archivos) {
  if (!archivos.length) return archivos;
  const { rows } = await pool.query(`SELECT ae.archivo_id, e.id, e.nombre
    FROM archivo_etiquetas ae JOIN etiquetas e ON e.id=ae.etiqueta_id
    WHERE ae.archivo_id = ANY($1::uuid[]) ORDER BY e.nombre`, [archivos.map(a => a.id)]);
  const porArchivo = new Map();
  for (const {archivo_id, id, nombre} of rows) {
    if (!porArchivo.has(archivo_id)) porArchivo.set(archivo_id, []);
    porArchivo.get(archivo_id).push({id, nombre});
  }
  return archivos.map(a => ({...a, etiquetas: porArchivo.get(a.id) || []}));
}
async function asignar(id, nombres) {
  const etiquetas = [];
  // Orden estable para evitar interbloqueos entre subidas con etiquetas compartidas.
  for (const nombre of [...nombres].sort()) {
    const { rows: [etiqueta] } = await pool.query(`INSERT INTO etiquetas(nombre) VALUES($1)
      ON CONFLICT(nombre) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id,nombre`, [nombre]);
    await pool.query('INSERT INTO archivo_etiquetas(archivo_id,etiqueta_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, etiqueta.id]);
    etiquetas.push(etiqueta);
  }
  return etiquetas;
}
async function reemplazarEtiquetas(id, usuarioId, nombres) {
  return conTransaccion(async (repo, client) => {
    const { rows: [archivo] } = await client.query(`SELECT id, nombre_original, tamanio_bytes,
      tipo_mime, es_publica, carpeta_id, created_at FROM archivos WHERE id=$1 AND usuario_id=$2 FOR UPDATE`, [id, usuarioId]);
    if (!archivo) return null;
    await client.query('DELETE FROM archivo_etiquetas WHERE archivo_id=$1', [id]);
    return {...archivo, etiquetas: await repo.asignar(id, nombres)};
  });
}


async function listarPublicos() {
  const { rows } = await pool.query(`SELECT id, usuario_id, nombre_original, tamanio_bytes,
    tipo_mime, es_publica, created_at FROM archivos WHERE es_publica = TRUE ORDER BY created_at DESC`);
  return conEtiquetas(rows);
}

async function buscarDescargable(id, usuarioId) {
  const { rows } = await pool.query(`SELECT * FROM archivos
    WHERE id = $1 AND (usuario_id = $2 OR es_publica = TRUE)`, [id, usuarioId]);
  return rows[0] || null;
}

async function listarPorUsuario(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, nombre_original, tamanio_bytes, tipo_mime,
            es_publica, carpeta_id, created_at
     FROM archivos
     WHERE usuario_id = $1
     ORDER BY created_at DESC`,
    [usuarioId]
  );

  return conEtiquetas(rows);
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
  etiquetas = [],
}) {
  if (!enTransaccion) return conTransaccion(repo => repo.registrar({usuarioId, nombreOriginal, nombreObjeto, rutaMinio, tamanioBytes, tipoMime, carpetaId, esPublica, etiquetas}));
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

  return {...rows[0], etiquetas: await asignar(rows[0].id, etiquetas)};
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

  return (await conEtiquetas(rows))[0] || null;
}


return {
  asignar,
  reemplazarEtiquetas,
  listarPublicos,
  buscarDescargable,
  listarPorUsuario,
  buscarPorIdYUsuario,
  registrar,
  eliminarRegistro,
  actualizarVisibilidad,
};

}
module.exports = { ...crearArchivoRepositorio(require('./db')), crearArchivoRepositorio };
