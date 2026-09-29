const { ESTADO } = require('../domain/estadoCuenta');
const { ErrorApp } = require('../domain/errores');
const { emailValido, normalizarCorreo } = require('../domain/validaciones');
const repo = require('../infrastructure/usuarioRepositorio');
const { enviarVerificacion } = require('./enviarVerificacion');

async function reenviarVerificacion(correoCrudo) {
  const correo = normalizarCorreo(correoCrudo);
  if (!emailValido(correo)) throw new ErrorApp('Correo no válido', 400);

  const usuario = await repo.buscarPendientePorCorreo(correo, ESTADO.INACTIVO);
  if (usuario) await enviarVerificacion(usuario);

  // Misma respuesta exista o no el correo, para no revelar qué cuentas hay
  return { mensaje: 'Si el correo está pendiente de confirmar, te enviamos un nuevo enlace.' };
}

module.exports = { reenviarVerificacion };
