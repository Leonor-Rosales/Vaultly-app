const express = require('express');
const { requiereAuth } = require('./middleware/auth');

const router = express.Router();

// Todas las rutas de archivos exigen sesión iniciada.
router.use(requiereAuth);

// PENDIENTE: subir, descargar y eliminar archivos con MinIO (bucket vaultly-files).
// Recuerda que eliminar un archivo requiere coordinar PostgreSQL y MinIO.
router.get('/', (req, res) => {
  res.status(501).json({ error: 'Módulo de archivos pendiente de implementar' });
});

module.exports = router;
