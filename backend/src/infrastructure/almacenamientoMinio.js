const { minio, MINIO_BUCKET, asegurarBucket } = require('./minioCliente');

async function guardar({ nombreObjeto, contenido, tamanioBytes, tipoMime }) {
  await asegurarBucket();
  await minio.putObject(MINIO_BUCKET, nombreObjeto, contenido, tamanioBytes, {
    'Content-Type': tipoMime,
  });
  return `${MINIO_BUCKET}/${nombreObjeto}`;
}

module.exports = {
  guardar,
  abrir: (nombreObjeto) => minio.getObject(MINIO_BUCKET, nombreObjeto),
  eliminar: (nombreObjeto) => minio.removeObject(MINIO_BUCKET, nombreObjeto),
};
