const { ErrorApp } = require('../domain/errores');
const { normalizarCorreo } = require('../domain/validaciones');
const repo = require('../infrastructure/usuarioRepositorio');
const { crearTokenRecuperacion } = require('../infrastructure/tokens');
const {
  enviarCorreoRecuperacion,
} = require('./enviarCorreoRecuperacion');

async function solicitarRecuperacion(correo) {
  if (!correo || typeof correo !== 'string') {
    throw new ErrorApp('El correo electrónico es obligatorio', 400);
  }

  const correoNormalizado = normalizarCorreo(correo);

  const usuario = await repo.buscarPorCorreoConRol(correoNormalizado);

  // No revelamos si el correo existe o no.
  if (!usuario) {
    return {
      mensaje:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  const token = crearTokenRecuperacion(usuario.id);

  await enviarCorreoRecuperacion({
    para: usuario.correo_electronico,
    nombre: usuario.nombre_completo,
    token,
  });

  return {
    mensaje:
      'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
  };
}

module.exports = { solicitarRecuperacion };