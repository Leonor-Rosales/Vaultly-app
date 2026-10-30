const express = require('express');
const { ErrorApp } = require('../domain/errores');
const { requiereRol } = require('./middleware/auth');
function crearCambioCorreoRoutes(casos, auth, roles = ['ADMIN']) {
  const r = express.Router();
  r.use(auth, requiereRol(...roles));
  r.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const responder = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(e instanceof ErrorApp ? e.estado : 500).json({ error: e instanceof ErrorApp ? e.message : 'No se pudo completar la operación. Inténtalo de nuevo.', codigo: e instanceof ErrorApp ? e.codigo : undefined }); }
  };
  r.get('/', responder(req => casos.estado(req.usuario.sub)));
  r.post('/', responder(req => casos.solicitar(req.usuario.sub, req.body)));
  r.post('/confirmar', responder(req => casos.confirmar(req.usuario.sub, req.body)));
  r.delete('/', responder(req => casos.cancelar(req.usuario.sub)));
  return r;
}
module.exports = { crearCambioCorreoRoutes };
