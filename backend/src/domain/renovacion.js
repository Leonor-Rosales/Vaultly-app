const { randomUUID } = require('crypto');

const codigoTransaccion = () => `VLT-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

const sumarMes = (fecha) => {
  const fin = new Date(fecha);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return fin;
};

/**
 * Una suscripción de pago vencida se renueva sola solo si el usuario lo pidió
 * y su plan sigue a la venta y es de pago. Si no, el usuario vuelve a Free.
 */
function debeRenovar(suscripcion, planActivo, ahora) {
  return Boolean(
    suscripcion
    && suscripcion.estado === 'ACTIVA'
    && suscripcion.renovacion_automatica === true
    && new Date(suscripcion.fecha_inicio) <= ahora
    && new Date(suscripcion.fecha_fin) <= ahora
    && planActivo
    && Number(planActivo.precio_mensual) > 0,
  );
}

module.exports = { codigoTransaccion, sumarMes, debeRenovar };
