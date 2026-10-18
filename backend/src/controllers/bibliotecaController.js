const { Router } = require('express');
const { ErrorApp } = require('../domain/errores');

function crearBibliotecaRoutes(casos, requiereAuth) {
  const router = Router();
  router.use(requiereAuth);

  const manejar = (mensaje, handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (!(error instanceof ErrorApp)) console.error(mensaje, error);
      res.status(error instanceof ErrorApp ? error.estado : 500).json({
        error: error instanceof ErrorApp ? error.message : mensaje,
        ...(error.codigo ? { codigo: error.codigo } : {}),
      });
    }
  };

  router.get('/archivos', requireAuth, manejar(listarArchivosBiblioteca));
  router.get('/etiquetas', requireAuth, manejar(listarEtiquetasBiblioteca));
  router.get('/autores', requireAuth, manejar(listarAutoresBiblioteca));

  return router;
}

module.exports = { crearBibliotecaRoutes };