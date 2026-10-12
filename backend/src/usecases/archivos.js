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
function crearCasosArchivos({ repositorio, almacenamiento, cuotas, registrarError = console.error }) {
  return {
    listar: (usuarioId) => repositorio.listarPorUsuario(usuarioId),
    listarPublicos: () => repositorio.listarPublicos(),
    async subir(usuarioId, datos, esPublica) {
      if (!datos) throw new ErrorApp('Debes seleccionar un archivo', 400);
      const nombreOriginal = path.basename(datos.nombreOriginal).slice(0, 255);
      if (!nombreOriginal.trim()) throw new ErrorApp('Nombre de archivo inválido', 400);
      const nombreObjeto = `${usuarioId}/${randomUUID()}`;
      const tipoMime = (datos.tipoMime || 'application/octet-stream').slice(0, 100);
      const reserva = await cuotas.reservarSubida(usuarioId, nombreObjeto, datos.tamanioBytes);
      try {
        return await cuotas.ejecutarSubida(usuarioId, reserva, async (repoTx) => {
          const rutaMinio = await almacenamiento.guardar({
            nombreObjeto, contenido: datos.contenido, tamanioBytes: datos.tamanioBytes, tipoMime,
          });
          return repoTx.registrar({
            usuarioId, nombreOriginal, nombreObjeto, rutaMinio,
            tamanioBytes: datos.tamanioBytes, tipoMime, esPublica,
          });
        });
      } catch (error) {
        try { await cuotas.compensarSubida(usuarioId, reserva); }
        catch (errorLimpieza) { registrarError('No se pudo limpiar el objeto; reserva pendiente:', errorLimpieza); }
        throw error;
      }
    },
    async descargar(id, usuarioId) {
      const reserva = await cuotas.reservarDescarga(usuarioId, id);
      try {
        const stream = await almacenamiento.abrir(reserva.archivo.nombre_objeto_minio);
        return {
          archivo: reserva.archivo, stream,
          iniciar: () => cuotas.iniciarDescarga(usuarioId, reserva.id, id),
          cancelar: () => cuotas.devolverDescarga(usuarioId, reserva.id),
        };
      } catch (error) {
        try { await cuotas.devolverDescarga(usuarioId, reserva.id); }
        catch (fallo) { registrarError('Descarga pendiente de devolución:', fallo); }
        throw error;
      }
    },
    eliminar: (id, usuarioId) => cuotas.eliminar(usuarioId, async (repoTx) => {
      const archivo = await repoTx.buscarPorIdYUsuario(id, usuarioId);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      // No es atómico con MinIO. Si falla DB, el espacio sigue contando.
      await almacenamiento.eliminar(archivo.nombre_objeto_minio);
      if (!await repoTx.eliminarRegistro(archivo.id, usuarioId)) {
        throw new ErrorApp('El objeto se eliminó, pero no se pudo eliminar su registro', 500);
      }
      return { mensaje: 'Archivo eliminado correctamente' };
    }),
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
