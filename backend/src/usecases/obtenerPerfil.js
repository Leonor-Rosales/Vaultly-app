const { ErrorApp } = require('../domain/errores');

function crearObtenerPerfil({ repo }) {
  async function obtenerPerfil(idUsuario) {
    const usuario = await repo.buscarPorIdConRol(idUsuario);
    if (!usuario) throw new ErrorApp('Usuario no encontrado', 404);
    return { usuario };
  }
  return obtenerPerfil;
}

module.exports = { crearObtenerPerfil };
