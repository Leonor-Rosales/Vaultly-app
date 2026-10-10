
const Minio = require('minio');

const {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_USE_SSL,
  MINIO_ROOT_USER,
  MINIO_ROOT_PASSWORD,
  MINIO_BUCKET,
} = require('./config');

if (!MINIO_ROOT_USER || !MINIO_ROOT_PASSWORD) {
  throw new Error('Faltan las credenciales de MinIO en backend/.env');
}

const minio = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ROOT_USER,
  secretKey: MINIO_ROOT_PASSWORD,
});

async function asegurarBucket() {
  const existe = await minio.bucketExists(MINIO_BUCKET);

  if (!existe) {
    await minio.makeBucket(MINIO_BUCKET);
  }
}

module.exports = {
  minio,
  MINIO_BUCKET,
  asegurarBucket,
};
