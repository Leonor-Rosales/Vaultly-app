const express = require('express');
const multer = require('multer');
const { pipeline } = require('node:stream/promises');

const { ErrorApp } = require('../domain/errores');
const { transmitirDescarga } = require('./transmitirDescarga');

function crearArchivosRoutes(casos, requiereAuth, vistasPrevias) {
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
      ...(req.body?.carpeta_id !== undefined && { carpetaId: req.body.carpeta_id }),
      tamanioBytes: req.file.size,
    };
    let etiquetas = [];
    if (req.body?.etiquetas !== undefined) {
      if (typeof req.body.etiquetas !== 'string') throw new ErrorApp('etiquetas debe contener un array JSON de textos', 400);
      try { etiquetas = JSON.parse(req.body.etiquetas); }
      catch { throw new ErrorApp('El campo etiquetas contiene JSON mal formado', 400); }
    }
    res.status(201).json(await casos.subir(req.usuario.sub, datos, req.body?.es_publica === 'true', etiquetas));
  }));
  router.patch('/:id/nombre', manejar('No se pudo renombrar el archivo', async (req, res) => {
    res.json(await casos.renombrar(req.params.id, req.usuario.sub, req.body?.nombre));
  }));
  router.patch('/:id/etiquetas', manejar('No se pudieron guardar las etiquetas', async (req, res) => {
    res.json(await casos.editarEtiquetas(req.params.id, req.usuario.sub, req.body?.etiquetas));
  }));
  router.patch('/:id/visibilidad', manejar('No se pudo cambiar la visibilidad del archivo', async (req, res) => {
    res.json(await casos.cambiarVisibilidad(req.params.id, req.usuario.sub, req.body?.es_publica));
  }));
  router.get('/:id/estado-vista-previa', manejar('No se pudo consultar la vista previa', async (req, res) => {
    res.set('Cache-Control', 'private, no-store').json(await vistasPrevias.estado(req.params.id, req.usuario.sub));
  }));
  router.post('/:id/reintentar-vista-previa', manejar('No se pudo reintentar la vista previa', async (req, res) => {
    res.json(await vistasPrevias.reintentar(req.params.id, req.usuario.sub));
  }));
  router.get('/:id/miniatura', manejar('No se pudo cargar la miniatura', async (req, res) => {
    const { stream, tipo } = await vistasPrevias.abrir(req.params.id, req.usuario.sub, true);
    res.set({ 'Content-Type': tipo, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    await pipeline(stream, res);
  }));
  router.get('/:id/vista-previa', manejar('No se pudo abrir la vista previa', async (req, res) => {
    const { tipo, stream } = await casos.vistaPrevia(req.params.id, req.usuario.sub);
    res.set({ 'Content-Type': tipo, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'", 'Content-Disposition': 'attachment' });
    await pipeline(stream, res);
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
