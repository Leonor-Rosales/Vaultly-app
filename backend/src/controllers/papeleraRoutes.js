const {Router} = require('express');
const {ErrorApp} = require('../domain/errores');
function crearPapeleraRoutes(casos,auth) {
  const router = Router();
  router.use(auth);
  const atender = fn => async (req,res) => {
    try { res.json(await fn(req) ?? {ok:true}); }
    catch (e) { res.status(e.estado || (e.code === '22P02' ? 400 : 500)).json({error:e instanceof ErrorApp ? e.message : 'No se pudo completar la operación de papelera.'}); }
  };
  router.get('/',atender(req=>casos.listar(req.usuario.sub)));
  router.post('/:id/restaurar',atender(req=>{
    const {nombre, aceptarRaiz} = req.body ?? {};
    if (nombre !== undefined && typeof nombre !== 'string') throw new ErrorApp('Nombre inválido.',400);
    return casos.restaurar(req.usuario.sub,req.params.id,nombre,aceptarRaiz === true);
  }));
  router.delete('/:id',atender(req=>casos.purgar(req.usuario.sub,req.params.id)));
  return router;
}
module.exports = {crearPapeleraRoutes};
