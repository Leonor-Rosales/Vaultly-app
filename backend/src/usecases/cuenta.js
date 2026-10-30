const { ErrorApp } = require('../domain/errores');
function crearCasosCuenta({ repo }) {
  return {
    async guardarNombre(id, datos) {
      if (!datos || Array.isArray(datos) || Object.keys(datos).some(k => k !== 'nombre_completo') ||
        typeof datos.nombre_completo !== 'string' || !datos.nombre_completo.trim() || datos.nombre_completo.trim().length > 150) {
        throw new ErrorApp('Envía únicamente un nombre completo de hasta 150 caracteres', 400);
      }
      const usuario = await repo.guardarNombre(id, datos.nombre_completo.trim());
      if (!usuario) throw new ErrorApp('Tu cuenta no está activa', 403);
      return { usuario };
    },
  };
}
module.exports = { crearCasosCuenta };
