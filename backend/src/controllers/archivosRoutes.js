const express = require('express');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { finished } = require('node:stream/promises');
const { crearRecepcionArchivo } = require('./recibirArchivo');

const { ErrorApp } = require('../domain/errores');
const { transmitirDescarga } = require('./transmitirDescarga');

function crearArchivosRoutes(casos, requiereAuth, opcionesSubida = {}) {
  const router = express.Router();
  const recibirArchivo = crearRecepcionArchivo(opcionesSubida);
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
  router.post('/', manejar('No se pudo subir el archivo', async (req, res) => {
    let contenido;
    try {
      await recibirArchivo(req, res);
      if (req.aborted || res.destroyed) throw new ErrorApp('Carga cancelada.', 400);
      let etiquetas = [];
      if (req.body?.etiquetas !== undefined) {
        if (typeof req.body.etiquetas !== 'string') throw new ErrorApp('etiquetas debe contener un array JSON de textos', 400);
        try { etiquetas = JSON.parse(req.body.etiquetas); }
        catch { throw new ErrorApp('El campo etiquetas contiene JSON mal formado', 400); }
      }
      // Abrir el archivo solo cuando el almacenamiento lo consuma, después de validar la cuota.
      // El generador propaga errores de lectura sin abrir un stream huérfano si se rechaza la cuota.
      if (req.file) contenido = Readable.from((async function* () {
        yield* fs.createReadStream(req.file.path);
      })());
      const datos = req.file && {
        nombreOriginal: req.file.originalname, tipoMime: req.file.mimetype,
        contenido, tamanioBytes: req.file.size,
      };
      const archivo = await casos.subir(req.usuario.sub, datos, req.body?.es_publica === 'true', etiquetas);
      res.status(201).json(archivo);
    } finally {
      if (contenido) {
        const cerrado = finished(contenido).catch(() => {});
        contenido.destroy();
        await cerrado;
      }
      // Multer limpia las recepciones truncadas; aquí se limpian también éxito y rechazos de negocio.
      if (req.file?.path) await fs.promises.unlink(req.file.path).catch(error => {
        if (error.code !== 'ENOENT') console.error('No se pudo retirar el temporal de subida:', error);
      });
    }
  }));
  router.patch('/:id/etiquetas', manejar('No se pudieron guardar las etiquetas', async (req, res) => {
    res.json(await casos.editarEtiquetas(req.params.id, req.usuario.sub, req.body?.etiquetas));
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
