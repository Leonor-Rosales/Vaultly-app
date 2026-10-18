const { randomUUID } = require('crypto');
const { ErrorApp } = require('../domain/errores');
const { policy, vigente } = require('../domain/cuotas');

const METODOS = { tarjeta: 'TARJETA' }; // solo tarjeta simulada; pagos viejos con transferencia se siguen mostrando

const presentar = (p) => ({
  id: p.id,
  fecha: new Date(p.creado_en).toISOString(),
  codigo: p.codigo,
  plan: p.plan_nombre,
  monto: Number(p.monto),
  metodo: p.metodo === 'TARJETA' ? 'tarjeta' : 'transferencia',
  estado: p.estado === 'COMPLETADO' ? 'Completado' : 'Pendiente',
});

const codigoTransaccion = () => `VLT-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
const sumarMes = (fecha) => {
  const fin = new Date(fecha);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return fin;
};

/**
 * Puerto repo: conUsuario(id, fn) con tx.plan, activa, cerrarSuscripcion, crearSuscripcion,
 * usados, reservados, registrarPago, listarPagos (ver pagosRepositorio).
 * El cobro es SIMULADO: no se reciben ni guardan datos de tarjeta; el monto sale del plan en DB.
 */
function crearCasosPagos({ repo }) {
  return {
    contratar: (usuarioId, { planId, metodo } = {}) => {
      const id = Number(planId);
      if (!Number.isInteger(id) || id <= 0) throw new ErrorApp('Plan inválido.', 400, 'PLAN_INVALIDO');
      const metodoDb = Object.hasOwn(METODOS, metodo) ? METODOS[metodo] : undefined;
      if (!metodoDb) throw new ErrorApp('Método de pago inválido.', 400, 'METODO_INVALIDO');

      return repo.conUsuario(usuarioId, async (tx) => {
        const plan = await tx.plan(id);
        if (!plan) throw new ErrorApp('El plan no existe o no está disponible.', 404, 'PLAN_NO_ENCONTRADO');
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
        await tx.crearSuscripcion(plan.id, tx.ahora, sumarMes(tx.ahora));
        const pago = await tx.registrarPago({
          id: randomUUID(), planId: plan.id, planNombre: plan.nombre, monto,
          metodo: metodoDb, estado: 'COMPLETADO', codigo: codigoTransaccion(), fecha: tx.ahora,
        });
        return presentar(pago);
      });
    },
    historial: (usuarioId) => repo.conUsuario(usuarioId, async (tx) => (await tx.listarPagos()).map(presentar)),
  };
}
module.exports = { crearCasosPagos };
