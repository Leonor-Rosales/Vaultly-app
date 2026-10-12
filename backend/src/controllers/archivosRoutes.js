const express = require('express');
const multer = require('multer');

const { ErrorApp } = require('../domain/errores');
const { transmitirDescarga } = require('./transmitirDescarga');

function crearArchivosRoutes(casos, requiereAuth) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
  router.use(requiereAuth);
  const manejar = (mensaje, handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (!(error instanceof ErrorApp)) console.error(mensaje, error);
      if (!res.headersSent) {
        res.status(error instanceof ErrorApp ? error.estado : 500).json({
          error: error instanceof ErrorApp ? error.message : mensaje,
          ...(error.codigo ? { codigo: error.codigo } : {}),
        });
      } else {
        res.destroy(error);
      }
    }
  };
  router.get('/', manejar('No se pudieron listar los archivos', async (req, res) => {
    res.json(await casos.listar(req.usuario.sub));
  }));
  router.get('/publicos', manejar('No se pudo cargar la biblioteca pública', async (_req, res) => {
    res.json(await casos.listarPublicos());
  }));
  router.post('/', upload.single('archivo'), manejar('No se pudo subir el archivo', async (req, res) => {
    const datos = req.file && {
      nombreOriginal: req.file.originalname,
      tipoMime: req.file.mimetype,
      contenido: req.file.buffer,
      tamanioBytes: req.file.size,
    };
    res.status(201).json(await casos.subir(req.usuario.sub, datos, req.body?.es_publica === 'true'));
  }));
  router.patch('/:id/visibilidad', manejar('No se pudo cambiar la visibilidad del archivo', async (req, res) => {
    res.json(await casos.cambiarVisibilidad(req.params.id, req.usuario.sub, req.body?.es_publica));
  }));
  router.get('/:id/descargar', manejar('No se pudo descargar el archivo', async (req, res) => {
    await transmitirDescarga(await casos.descargar(req.params.id, req.usuario.sub), res);
  }));
  router.delete('/:id', manejar('No se pudo eliminar el archivo', async (req, res) => {
    res.json(await casos.eliminar(req.params.id, req.usuario.sub));
  }));
  return router;
}
module.exports = { crearArchivosRoutes };
