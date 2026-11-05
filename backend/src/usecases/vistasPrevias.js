const { ErrorApp } = require('../domain/errores');
const { formatoVistaPrevia } = require('../../../shared/vista-previa.mjs');

const objetos = id => ({ pdf: `vistas-previas/${id}/documento.pdf`, miniatura: `vistas-previas/${id}/miniatura.png` });

function crearCasosVistasPrevias({ archivos, repo, almacenamiento, convertir, registrarError = console.error }) {
  async function autorizar(id, usuarioId, soloPropietario = false) {
    const archivo = soloPropietario ? await archivos.buscarPorIdYUsuario(id, usuarioId)
      : await archivos.buscarDescargable(id, usuarioId);
    if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
    if (!['docx', 'xlsx'].includes(formatoVistaPrevia(archivo.nombre_original, archivo.tipo_mime))) {
      throw new ErrorApp('Este formato no requiere conversión', 415);
    }
  }
  return {
    async estado(id, usuarioId) {
      await autorizar(id, usuarioId);
      return await repo.consultar(id) || { estado: 'PENDIENTE' };
    },
    async reintentar(id, usuarioId) {
      await autorizar(id, usuarioId, true);
      await repo.reintentar(id);
      return await repo.consultar(id) || { estado: 'PENDIENTE' };
    },
    async abrir(id, usuarioId, miniatura = false) {
      await autorizar(id, usuarioId);
      if ((await repo.consultar(id))?.estado !== 'LISTA') throw new ErrorApp('La vista previa todavía no está lista', 409);
      return {
        tipo: miniatura ? 'image/png' : 'application/pdf',
        stream: await almacenamiento.abrir(miniatura ? objetos(id).miniatura : objetos(id).pdf),
      };
    },
    async procesarSiguiente() {
      await repo.trabajar(async (trabajo, operaciones) => {
        const claves = objetos(trabajo.id);
        const formato = formatoVistaPrevia(trabajo.nombre_original || '', trabajo.tipo_mime || '');
        if (!trabajo.archivo_id || !['docx', 'xlsx'].includes(formato)) {
          try {
            await almacenamiento.eliminar(claves.pdf);
            await almacenamiento.eliminar(claves.miniatura);
            await operaciones.eliminar();
          } catch (error) {
            registrarError('Limpieza de vista previa pendiente', error.message);
            await operaciones.posponerLimpieza();
          }
          return;
        }
        // Un trabajo abandonado también consume intento para limitar fallos repetidos.
        if (trabajo.intentos >= 3) { await operaciones.fallar(); return; }
        await operaciones.iniciar();
        try {
          await convertir(trabajo, formato, async ({ pdf, miniatura }) => {
            await almacenamiento.guardarDerivado(claves.pdf, pdf, 'application/pdf');
            await almacenamiento.guardarDerivado(claves.miniatura, miniatura, 'image/png');
          });
          await operaciones.completar();
        } catch (error) {
          registrarError('Conversión pendiente o fallida', trabajo.id, error.message);
          await operaciones.fallar();
        }
      });
    },
  };
}
module.exports = { crearCasosVistasPrevias };
