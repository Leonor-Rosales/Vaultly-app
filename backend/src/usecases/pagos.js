const { randomUUID } = require('crypto');
const { ErrorApp } = require('../domain/errores');
const { policy, vigente } = require('../domain/cuotas');
const { codigoTransaccion, sumarMes } = require('../domain/renovacion');
const { datosComprobante } = require('../domain/comprobante');

const METODOS = { tarjeta: 'TARJETA' }; // solo tarjeta simulada; pagos viejos con transferencia se siguen mostrando

const presentar = (p) => ({
  id: p.id,
  fecha: new Date(p.creado_en).toISOString(),
  codigo: p.codigo,
  plan: p.plan_nombre,
  monto: Number(p.monto),
  metodo: p.metodo === 'TARJETA' ? 'tarjeta' : 'transferencia',
  estado: p.estado === 'COMPLETADO' ? 'Completado' : 'Pendiente',
  comprobante: p.comprobante ?? null,
});

/**
 * Puerto repo: conUsuario(id, fn) con tx.plan, activa, cerrarSuscripcion, crearSuscripcion,
 * usados, reservados, registrarPago, listarPagos, actualizarRenovacion (ver pagosRepositorio).
 * El cobro es SIMULADO: no se reciben ni guardan datos de tarjeta; el monto sale del plan en DB.
 */
function crearCasosPagos({ repo }) {
  return {
    contratar: (usuarioId, { planId, metodo, renovar, versionPlan } = {}) => {
      const id = Number(planId);
      if (!Number.isInteger(id) || id <= 0) throw new ErrorApp('Plan inválido.', 400, 'PLAN_INVALIDO');
      const metodoDb = Object.hasOwn(METODOS, metodo) ? METODOS[metodo] : undefined;
      if (!metodoDb) throw new ErrorApp('Método de pago inválido.', 400, 'METODO_INVALIDO');
      if (!Number.isInteger(versionPlan) || versionPlan <= 0) throw new ErrorApp('Actualiza el resumen del plan antes de confirmar.', 409, 'PLAN_DESACTUALIZADO');

      return repo.conUsuario(usuarioId, async (tx) => {
        const plan = await tx.plan(id);
        if (!plan) throw new ErrorApp('El plan no existe o no está disponible.', 404, 'PLAN_NO_ENCONTRADO');
        if (versionPlan !== plan.version) throw new ErrorApp('El precio o las condiciones del plan cambiaron. Actualiza el resumen y vuelve a confirmar. No se realizó ningún cobro.', 409, 'PLAN_DESACTUALIZADO');
        const monto = Number(plan.precio_mensual);
        if (monto <= 0) throw new ErrorApp('El plan Free no requiere pago.', 400, 'PLAN_GRATUITO');

        const activa = await tx.activa();
        if (vigente(activa, tx.ahora) && activa.plan_id === plan.id) {
          throw new ErrorApp('Ya tienes este plan contratado.', 409, 'PLAN_ACTUAL');
        }
        const cuota = plan.cuota_storage_gb * policy.bytesPerGB;
        if (await tx.usados() + await tx.reservados() > cuota) {
          throw new ErrorApp('Estás usando más almacenamiento del que permite ese plan. Libera espacio primero.', 409, 'CUOTA_ALMACENAMIENTO');
        }

        if (activa) await tx.cerrarSuscripcion(activa.id);
        const fin = sumarMes(tx.ahora);
        await tx.crearSuscripcion(plan.id, tx.ahora, fin, renovar === true);
        const pago = await tx.registrarPago({
          id: randomUUID(), planId: plan.id, planNombre: plan.nombre, monto,
          metodo: metodoDb, estado: 'COMPLETADO', codigo: codigoTransaccion(), fecha: tx.ahora,
          comprobante: datosComprobante(tx.cliente, plan, tx.ahora, fin),
        });
        return presentar(pago);
      });
    },
    // Activa o desactiva la renovación automática de la suscripción de pago vigente.
    configurarRenovacion: (usuarioId, { renovar } = {}) => {
      if (typeof renovar !== 'boolean') throw new ErrorApp('Indica si quieres renovar o no.', 400, 'RENOVACION_INVALIDA');
      return repo.conUsuario(usuarioId, async (tx) => {
        const suscripcion = await tx.actualizarRenovacion(renovar);
        if (!suscripcion) throw new ErrorApp('No tienes una suscripción de pago vigente.', 409, 'SIN_SUSCRIPCION_DE_PAGO');
        return { renovacionAutomatica: suscripcion.renovacion_automatica, fechaFin: new Date(suscripcion.fecha_fin).toISOString() };
      });
    },
    historial: (usuarioId) => repo.conUsuario(usuarioId, async (tx) => (await tx.listarPagos()).map(presentar)),
  };
}
module.exports = { crearCasosPagos };
