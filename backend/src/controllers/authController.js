const { ErrorApp } = require('../domain/errores');
const { FRONTEND_URL } = require('../infrastructure/config');
const { registrarUsuario } = require('../usecases/registrarUsuario');
const { iniciarSesion } = require('../usecases/iniciarSesion');
const { verificarCorreo } = require('../usecases/verificarCorreo');
const { reenviarVerificacion } = require('../usecases/reenviarVerificacion');
const { obtenerPerfil } = require('../usecases/obtenerPerfil');

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
    return res.redirect(`${FRONTEND_URL}/login?verificado=1`);
  }
  res.redirect(`${FRONTEND_URL}/login?error=${resultado}`);
});

const reenviar = manejar(async (req, res) => {
  res.json(await reenviarVerificacion((req.body || {}).correo_electronico));
});

const me = manejar(async (req, res) => {
  res.json(await obtenerPerfil(req.usuario.sub));
});

module.exports = { register, login, verificar, reenviar, me };
