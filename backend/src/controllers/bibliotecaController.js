
const { Router } = require('express');
const { ErrorPublico } = require('../usecases/biblioteca');

function crearBibliotecaRoutes(casos, requiereAuth) {
  const router = Router();

  router.use(requiereAuth);

  const manejar = (mensaje, handler) => async (req, res) => {
    try {
      const resultado = await handler(req);
      res.json(resultado);
    } catch (error) {
      console.error(mensaje, error);

      res.status(error instanceof ErrorPublico ? error.status : 500).json({
        error: error.message || mensaje,
        ...(error.codigo ? { codigo: error.codigo } : {}),
      });
    }
  };

  router.get(
    '/archivos',
    manejar('No se pudieron listar los archivos públicos', (req) =>
      casos.listarArchivosBiblioteca(req.query)
    )
  );

  router.get(
    '/etiquetas',
    manejar('No se pudieron listar las etiquetas públicas', (req) =>
      casos.listarEtiquetasBiblioteca(req.query)
    )
  );

  router.get(
    '/autores',
    manejar('No se pudieron listar los autores públicos', (req) =>
      casos.listarAutoresBiblioteca(req.query)
    )
  );

  return router;
}

module.exports = { crearBibliotecaRoutes };
