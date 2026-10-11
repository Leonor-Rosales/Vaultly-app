const { ErrorApp } = require('../domain/errores');

function crearAuthController({ casos, frontendUrl }) {
  const { registrarUsuario, iniciarSesion, verificarCorreo, reenviarVerificacion, obtenerPerfil, solicitarRecuperacion, restablecerPassword } = casos;

  function responderError(res, err) {
    if (err instanceof ErrorApp) {
      const cuerpo = { error: err.message };
      if (err.codigo) cuerpo.codigo = err.codigo;
      return res.status(err.estado).json(cuerpo);
    }
    console.error('Error inesperado:', err.code || '', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }

  // Envuelve un handler para no repetir el try/catch
  const manejar = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      responderError(res, err);
    }
  };

  const register = manejar(async (req, res) => {
    const resultado = await registrarUsuario(req.body || {});
    res.status(201).json(resultado);
  });

  const login = manejar(async (req, res) => {
    res.json(await iniciarSesion(req.body || {}));
  });

  // Es el enlace del correo: activa la cuenta y redirige al frontend
  const verificar = manejar(async (req, res) => {
    const resultado = await verificarCorreo(String(req.query.token || ''));
    if (resultado === 'verificado') {
      return res.redirect(`${frontendUrl}/login?verificado=1`);
    }
    res.redirect(`${frontendUrl}/login?error=${resultado}`);
  });

  const reenviar = manejar(async (req, res) => {
    res.json(await reenviarVerificacion((req.body || {}).correo_electronico));
  });

  const me = manejar(async (req, res) => {
    res.json(await obtenerPerfil(req.usuario.sub));
  });

  const recuperar = manejar(async (req, res) => {
    const resultado = await solicitarRecuperacion(
      (req.body || {}).email
    );

    res.json(resultado);
  });

  const restablecer = manejar(async (req, res) => {
    const resultado = await restablecerPassword(
      (req.body || {}).token,
      (req.body || {}).password
    );

    res.json(resultado);
  });
  return {
    register,
    login,
    verificar,
    reenviar,
    me,
    recuperar,
    restablecer,
  };

}

module.exports = { crearAuthController };
