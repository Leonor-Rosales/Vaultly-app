const express = require('express');
const { ErrorApp } = require('../domain/errores');

function crearPlanesRoutes(casos, requiereAuth) {
  const router = express.Router();
  router.use(requiereAuth);
  const responder = (fn) => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (error) {
      res.status(error instanceof ErrorApp ? error.estado : 500).json({
        error: error instanceof ErrorApp ? error.message : 'No se pudo consultar tu plan.',
        ...(error.codigo ? { codigo: error.codigo } : {}),
      });
    }
  };
  router.get('/', responder(() => casos.catalogo()));
  router.get('/mi-consumo', responder(req => casos.consultar(req.usuario.sub)));
  return router;
}
module.exports = { crearPlanesRoutes };
