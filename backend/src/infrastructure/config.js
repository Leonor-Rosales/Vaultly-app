const PORT = Number(process.env.PORT || 3000);

module.exports = {
  PORT,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PORT}`,
};
