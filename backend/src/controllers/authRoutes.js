const express = require('express');

function crearAuthRoutes(auth, requiereAuth) {
  const router = express.Router();

  router.post('/register', auth.register);
  router.post('/login', auth.login);
  router.get('/verificar', auth.verificar);
  router.post('/reenviar-verificacion', auth.reenviar);
  router.get('/me', requiereAuth, auth.me);
  router.post('/recuperar', auth.recuperar);
  router.post('/restablecer', auth.restablecer);

  return router;
}

module.exports = { crearAuthRoutes };
