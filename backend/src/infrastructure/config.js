
const PORT = Number(process.env.PORT || 3000);

module.exports = {
  PORT,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PORT}`,

  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: Number(process.env.MINIO_PORT || 9000),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
  MINIO_ROOT_USER: process.env.MINIO_ROOT_USER,
  MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD,
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'vaultly-files',
};
