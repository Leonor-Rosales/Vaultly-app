const express = require('express');
const { ErrorApp } = require('../domain/errores');

function crearPlanesRoutes(casos, requiereAuth, pagos) {
  const router = express.Router();
  router.use(requiereAuth);
  const responder = (fn, falla = 'No se pudo consultar tu plan.') => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (error) {
      if (!(error instanceof ErrorApp)) console.error(error);
      res.status(error instanceof ErrorApp ? error.estado : 500).json({
        error: error instanceof ErrorApp ? error.message : falla,
        ...(error.codigo ? { codigo: error.codigo } : {}),
      });
    }
  };
  router.get('/', responder(() => casos.catalogo()));
  router.get('/mi-consumo', responder(req => casos.consultar(req.usuario.sub)));
  if (pagos) {
    router.get('/pagos', responder(req => pagos.historial(req.usuario.sub), 'No se pudo consultar tu historial de pagos.'));
    router.post('/contratar', responder(req => pagos.contratar(req.usuario.sub, req.body), 'No se pudo completar la contratación. No se realizó ningún cobro.'));
  }
  return router;
}
module.exports = { crearPlanesRoutes };
