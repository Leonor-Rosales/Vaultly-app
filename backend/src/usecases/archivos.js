const { randomUUID } = require('crypto');
const path = require('path');
const { formatoVistaPrevia, limiteTexto, tipoMultimedia } = require('../../../shared/vista-previa.mjs');
const { normalizarEtiquetas } = require('../domain/etiquetas');
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
function crearCasosArchivos({ repositorio, almacenamiento, cuotas, vistasPrevias, registrarError = console.error }) {
  return {
    listar: (usuarioId) => repositorio.listarPorUsuario(usuarioId),
    listarPublicos: () => repositorio.listarPublicos(),
    async subir(usuarioId, datos, esPublica, entradaEtiquetas = []) {
      const etiquetas = normalizarEtiquetas(entradaEtiquetas);
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
            tamanioBytes: datos.tamanioBytes, tipoMime, esPublica, etiquetas, carpetaId: datos.carpetaId ?? null,
          });
        });
      } catch (error) {
        try { await cuotas.compensarSubida(usuarioId, reserva); }
        catch (errorLimpieza) { registrarError('No se pudo limpiar el objeto; reserva pendiente:', errorLimpieza); }
        if (datos.carpetaId !== undefined && ['23503', '22P02'].includes(error.code)) throw new ErrorApp('Carpeta de destino inválida.', 400);
        throw error;
      }
    },
    async renombrar(id, usuarioId, entrada) {
      const nombre = typeof entrada === 'string' ? entrada.trim() : '';
      if (!nombre || [...nombre].length > 255 || nombre === '.' || nombre === '..' || /[\\/\p{Cc}]/u.test(nombre)) {
        throw new ErrorApp('Escribe un nombre de hasta 255 caracteres, sin separadores de ruta ni caracteres de control.', 400);
      }
      const archivo = await repositorio.actualizarNombre(id, usuarioId, nombre);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      return archivo;
    },
    async editarEtiquetas(id, usuarioId, entrada) {
      const etiquetas = normalizarEtiquetas(entrada);
      const archivo = await repositorio.reemplazarEtiquetas(id, usuarioId, etiquetas);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      return archivo;
    },
    async vistaPrevia(id, usuarioId) {
      const archivo = await repositorio.buscarPorIdYUsuario(id, usuarioId);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      const formato = formatoVistaPrevia(archivo.nombre_original, archivo.tipo_mime);
      if (['docx', 'xlsx'].includes(formato)) return vistasPrevias.abrir(id, usuarioId);
      if (!formato) throw new ErrorApp('Formato sin vista previa', 415);
      if (['texto', 'csv', 'tsv'].includes(formato)) {
        const grande = Number(archivo.tamanio_bytes) > limiteTexto;
        const stream = grande ? await almacenamiento.abrirInicio(archivo.nombre_objeto_minio, limiteTexto)
          : await almacenamiento.abrir(archivo.nombre_objeto_minio);
        return { tipo: 'text/plain', stream };
      }
      return { tipo: tipoMultimedia(archivo.nombre_original, archivo.tipo_mime) ?? archivo.tipo_mime, stream: await almacenamiento.abrir(archivo.nombre_objeto_minio) };
    },
    async descargar(id, usuarioId) {
      const reserva = await cuotas.reservarDescarga(usuarioId, id);
      try {
        const stream = await almacenamiento.abrir(reserva.archivo.nombre_objeto_minio);
        return {
          archivo: reserva.archivo, stream,
          iniciar: () => cuotas.iniciarDescarga(usuarioId, reserva.id, id),
          cancelar: () => cuotas.devolverDescarga(usuarioId, reserva.id),
          registrarDescarga: () => repositorio.incrementarDescargas(id, usuarioId),
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
