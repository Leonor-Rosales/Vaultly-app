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
  descargarTemporal: (objeto, destino) => minio.fGetObject(MINIO_BUCKET, objeto, destino),
  guardarDerivado: (objeto, archivo, tipo) => minio.fPutObject(MINIO_BUCKET, objeto, archivo, { "Content-Type": tipo }),
  abrir: (nombreObjeto) => minio.getObject(MINIO_BUCKET, nombreObjeto),
  abrirInicio: (nombreObjeto, bytes) => minio.getPartialObject(MINIO_BUCKET, nombreObjeto, 0, bytes),
  eliminar: (nombreObjeto) => minio.removeObject(MINIO_BUCKET, nombreObjeto),
};
