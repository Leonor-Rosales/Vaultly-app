const { randomUUID } = require('crypto');
const path = require('path');
const { ErrorApp } = require('../domain/errores');

/**
 * Contratos de puertos; todos los métodos son asíncronos.
 * Repositorio: listarPorUsuario(usuarioId), registrar(metadatos),
 * buscarPorIdYUsuario(id, usuarioId), eliminarRegistro(id, usuarioId),
 * actualizarVisibilidad(id, usuarioId, esPublica).
 * Las búsquedas/mutaciones filtran por propietario y devuelven null si no existe.
 * Almacenamiento: guardar({nombreObjeto, contenido, tamanioBytes, tipoMime})
 * devuelve la ruta persistible; abrir(nombreObjeto) devuelve un stream;
 * eliminar(nombreObjeto) es idempotente si el objeto ya no existe.
 * Ningún puerto recibe objetos de Express.
 */
function crearCasosArchivos({ repositorio, almacenamiento, registrarError = console.error }) {
  async function buscarPropio(id, usuarioId) {
    const archivo = await repositorio.buscarPorIdYUsuario(id, usuarioId);
    if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
    return archivo;
  }
  return {
    listar: (usuarioId) => repositorio.listarPorUsuario(usuarioId),
    async subir(usuarioId, datos, esPublica) {
      if (!datos) throw new ErrorApp('Debes seleccionar un archivo', 400);
      const nombreOriginal = path.basename(datos.nombreOriginal).slice(0, 255);
      if (!nombreOriginal.trim()) throw new ErrorApp('Nombre de archivo inválido', 400);
      const nombreObjeto = `${usuarioId}/${randomUUID()}`;
      const tipoMime = (datos.tipoMime || 'application/octet-stream').slice(0, 100);
      const rutaMinio = await almacenamiento.guardar({
        nombreObjeto, contenido: datos.contenido, tamanioBytes: datos.tamanioBytes, tipoMime,
      });
      try {
        return await repositorio.registrar({
          usuarioId, nombreOriginal, nombreObjeto, rutaMinio,
          tamanioBytes: datos.tamanioBytes, tipoMime, esPublica,
        });
      } catch (error) {
        try {
          await almacenamiento.eliminar(nombreObjeto);
        } catch (errorLimpieza) {
          registrarError('No se pudo limpiar el objeto:', errorLimpieza);
        }
        throw error;
      }
    },
    async descargar(id, usuarioId) {
      const archivo = await buscarPropio(id, usuarioId);
      const stream = await almacenamiento.abrir(archivo.nombre_objeto_minio);
      return { archivo, stream };
    },
    async eliminar(id, usuarioId) {
      const archivo = await buscarPropio(id, usuarioId);
      // No es atómico: si falla PostgreSQL, puede quedar un registro sin objeto.
      await almacenamiento.eliminar(archivo.nombre_objeto_minio);
      const eliminado = await repositorio.eliminarRegistro(archivo.id, usuarioId);
      if (!eliminado) {
        throw new ErrorApp('El objeto se eliminó, pero no se pudo eliminar su registro', 500);
      }
      return { mensaje: 'Archivo eliminado correctamente' };
    },
    async cambiarVisibilidad(id, usuarioId, esPublica) {
      if (typeof esPublica !== 'boolean') {
        throw new ErrorApp('La visibilidad debe ser true o false', 400);
      }
      const archivo = await repositorio.actualizarVisibilidad(id, usuarioId, esPublica);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      return archivo;
    },
  };
}
module.exports = { crearCasosArchivos };
