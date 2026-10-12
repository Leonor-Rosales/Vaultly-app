const { randomUUID } = require('crypto');
const { ErrorApp } = require('../domain/errores');
const { policy, cicloMensual, vigente, comprobarEspacio, resumen } = require('../domain/cuotas');

/**
 * Puerto repo: listarPlanes(), usuariosConReservasVencidas(), conUsuario(id, fn).
 * conUsuario ejecuta fn(tx) con exclusión entre procesos por usuario y transacción;
 * confirma al terminar o revierte ante error. tx proporciona tiempo de DB y métodos
 * de suscripciones, ciclos, archivos y reservas (ver adaptador). No se expone SQL.
 * Una reserva de subida sigue contando hasta confirmar metadatos o limpiar el objeto.
 * El bloqueo se conserva durante guardar/limpiar: otro proceso no recupera una
 * reserva mientras su dueño tiene una operación activa bajo el mismo bloqueo.
 */
function crearCasosCuotas({ repo, almacenamiento }) {
  const vencimiento = (ahora) => new Date(+ahora + policy.reservationMinutes * 60000);
  async function contexto(tx) {
    let suscripcion = await tx.activa();
    const ciclo = cicloMensual(tx.ahora);
    let plan;
    if (!vigente(suscripcion, tx.ahora)) {
      if (suscripcion) await tx.cerrarSuscripcion(suscripcion.id,
        new Date(suscripcion.fecha_inicio) > tx.ahora ? 'PENDIENTE' : 'VENCIDA');
      plan = await tx.free();
      if (!plan) throw new ErrorApp('No está disponible el plan Free. Contacta al administrador.', 503, 'PLAN_NO_DISPONIBLE');
      suscripcion = await tx.crearFree(plan.id, tx.ahora, ciclo.fin);
    } else {
      plan = { ...suscripcion, id: suscripcion.plan_id };
    }
    return { plan, ciclo: await tx.ciclo(ciclo.inicio, ciclo.fin) };
  }
  const casos = {
    catalogo: () => repo.listarPlanes(),
    consultar: (usuarioId) => repo.conUsuario(usuarioId, async tx => {
      const { plan, ciclo } = await contexto(tx);
      return resumen(plan, ciclo, await tx.usados(), await tx.reservados());
    }),
    reservarSubida: (usuarioId, nombreObjeto, bytes) => repo.conUsuario(usuarioId, async tx => {
      const { plan } = await contexto(tx);
      comprobarEspacio(await tx.usados(), await tx.reservados(), bytes, plan.cuota_storage_gb * policy.bytesPerGB);
      const id = randomUUID();
      await tx.reservarSubida({ id, nombreObjeto, bytes, vence: vencimiento(tx.ahora) });
      return id;
    }),
    ejecutarSubida: (usuarioId, id, guardar) => repo.conUsuario(usuarioId, async tx => {
      const reserva = await tx.subida(id);
      if (!reserva || new Date(reserva.vence_en) <= tx.ahora) throw new ErrorApp('La subida venció. Intenta de nuevo.', 409, 'RESERVA_VENCIDA');
      const { plan } = await contexto(tx);
      // Revalidar si el plan cambió desde la reserva. El total ya incluye esta subida.
      comprobarEspacio(await tx.usados(), await tx.reservados(), 0, plan.cuota_storage_gb * policy.bytesPerGB);
      const archivo = await guardar(tx.archivos);
      await tx.borrarSubida(id);
      return archivo;
    }),
    compensarSubida: (usuarioId, id) => repo.conUsuario(usuarioId, async tx => {
      const reserva = await tx.subida(id);
      if (!reserva) return; // Commit confirmado: no borrar un objeto con metadatos.
      await almacenamiento.eliminar(reserva.nombre_objeto);
      await tx.borrarSubida(id);
    }),
    eliminar: (usuarioId, operacion) => repo.conUsuario(usuarioId, tx => operacion(tx.archivos)),
    reservarDescarga: (usuarioId, archivoId) => repo.conUsuario(usuarioId, async tx => {
      const archivo = await tx.archivos.buscarDescargable(archivoId, usuarioId);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      // La propiedad se determina en DB, nunca por una bandera enviada por el cliente.
      if (archivo.usuario_id === usuarioId) return { id: null, archivo };
      const { plan, ciclo } = await contexto(tx);
      if (plan.limite_descargas !== null && Number(ciclo.consumidas) >= plan.limite_descargas) {
        throw new ErrorApp('Ya no tienes descargas disponibles en este ciclo.', 409, 'CUOTA_DESCARGAS');
      }
      const id = randomUUID();
      await tx.reservarDescarga(id, ciclo.inicio, vencimiento(tx.ahora));
      return { id, archivo };
    }),
    iniciarDescarga: (usuarioId, id, archivoId) => repo.conUsuario(usuarioId, async tx => {
      const archivo = await tx.archivos.buscarDescargable(archivoId, usuarioId);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      if (!id && archivo.usuario_id === usuarioId) return;
      const reserva = await tx.descarga(id);
      if (!reserva || new Date(reserva.vence_en) <= tx.ahora) throw new ErrorApp('La descarga venció. Intenta de nuevo.', 409, 'RESERVA_VENCIDA');
      const { plan, ciclo } = await contexto(tx);
      if (+new Date(reserva.ciclo_inicio) !== +new Date(ciclo.inicio)) throw new ErrorApp('Comenzó un nuevo ciclo. Intenta descargar de nuevo.', 409, 'CICLO_CAMBIO');
      if (plan.limite_descargas !== null && Number(ciclo.consumidas) > plan.limite_descargas) throw new ErrorApp('Ya no tienes descargas disponibles en este ciclo.', 409, 'CUOTA_DESCARGAS');
      await tx.iniciarDescarga(id);
    }),
    devolverDescarga: (usuarioId, id) => id ? repo.conUsuario(usuarioId, tx => tx.devolverDescarga(id)) : Promise.resolve(),
    async recuperarReservas() {
      const resultado = { usuarios: 0, fallos: 0 };
      for (const usuarioId of await repo.usuariosConReservasVencidas()) {
        try {
          await repo.conUsuario(usuarioId, async tx => {
            for (const r of await tx.vencidasSubida()) {
              await almacenamiento.eliminar(r.nombre_objeto);
              await tx.borrarSubida(r.id);
            }
            for (const r of await tx.vencidasDescarga()) await tx.devolverDescarga(r.id);
          });
          resultado.usuarios++;
        } catch { resultado.fallos++; }
      }
      return resultado;
    },
  };
  return casos;
}
module.exports = { crearCasosCuotas };
