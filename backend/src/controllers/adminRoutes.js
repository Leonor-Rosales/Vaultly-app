const express = require('express');
const { requiereRol } = require('./middleware/auth');
const { ErrorApp } = require('../domain/errores');
function crearAdminRoutes(casos, auth) {
  const r = express.Router();
  r.use(auth, requiereRol('ADMIN'));
  const responder = (fn, status = 200) => async (req, res) => {
    try { res.status(status).json(await fn(req)); }
    catch (e) { res.status(e instanceof ErrorApp ? e.estado : 500).json({ error: e instanceof ErrorApp ? e.message : 'No se pudo completar la operación' }); }
  };
  const idPlan = req => {
    if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) throw new ErrorApp('Plan inválido', 400);
    return Number(req.params.id);
  };
  const idUsuario = req => {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(req.params.id)) throw new ErrorApp('Administrador inválido', 400);
    return req.params.id;
  };
  r.get('/planes', responder(() => casos.listarPlanes()));
  r.post('/planes', responder(req => casos.guardarPlan(req.usuario.sub, null, req.body), 201));
  r.put('/planes/:id', responder(req => casos.guardarPlan(req.usuario.sub, idPlan(req), req.body)));
  r.get('/administradores', responder(() => casos.listarAdministradores()));
  r.post('/administradores', responder(req => casos.guardarAdministrador(req.usuario.sub, null, req.body), 201));
  r.put('/administradores/:id', responder(req => casos.guardarAdministrador(req.usuario.sub, idUsuario(req), req.body)));
  return r;
}
module.exports = { crearAdminRoutes };
