const { ErrorApp } = require('../domain/errores');
const repo = require('../infrastructure/usuarioRepositorio');

async function obtenerPerfil(idUsuario) {
  const usuario = await repo.buscarPorIdConRol(idUsuario);
  if (!usuario) throw new ErrorApp('Usuario no encontrado', 404);
  return { usuario };
}

module.exports = { obtenerPerfil };
