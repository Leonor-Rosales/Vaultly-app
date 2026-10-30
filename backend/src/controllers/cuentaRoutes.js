const express = require('express');
const { ErrorApp } = require('../domain/errores');
const { requiereRol } = require('./middleware/auth');
function crearCuentaRoutes(casos, auth) {
  const r = express.Router();
  r.use(auth, requiereRol('ADMIN', 'CLIENTE'));
  r.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  r.patch('/perfil', async (req, res) => {
    try { res.json(await casos.guardarNombre(req.usuario.sub, req.body)); }
    catch (e) { res.status(e instanceof ErrorApp ? e.estado : 500).json({ error: e instanceof ErrorApp ? e.message : 'No se pudo guardar el perfil' }); }
  });
  return r;
}
module.exports = { crearCuentaRoutes };
