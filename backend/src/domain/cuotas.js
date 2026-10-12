const policy = require('../../../shared/usage-policy.json');
const { ErrorApp } = require('./errores');

function cicloMensual(ahora) {
  const fecha = new Date(ahora);
  return {
    inicio: new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1)),
    fin: new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1)),
  };
}
function vigente(suscripcion, ahora) {
  return suscripcion && suscripcion.estado === 'ACTIVA'
    && new Date(suscripcion.fecha_inicio) <= ahora && new Date(suscripcion.fecha_fin) > ahora;
}
function comprobarEspacio(usados, reservados, tamanio, cuota) {
  if (!Number.isSafeInteger(tamanio) || tamanio < 0) throw new ErrorApp('Tamaño de archivo inválido', 400);
  if (usados + reservados + tamanio > cuota) {
    throw new ErrorApp('No tienes espacio suficiente para subir este archivo.', 409, 'CUOTA_ALMACENAMIENTO');
  }
}
function alerta(porcentaje) {
  return porcentaje >= 100 ? 'LIMITE' : porcentaje >= policy.warningPercent ? 'PROXIMIDAD' : null;
}
function resumen(plan, ciclo, usados, reservados) {
  const cuota = Number(plan.cuota_storage_gb) * policy.bytesPerGB;
  const consumidas = Number(ciclo.consumidas);
  const limite = plan.limite_descargas;
  const porcentaje = usados / cuota * 100;
  return {
    plan: { id: plan.id, nombre: plan.nombre, precio_mensual: Number(plan.precio_mensual) },
    almacenamiento: { cuota_bytes: cuota, usados_bytes: usados, reservados_bytes: reservados,
      disponibles_bytes: Math.max(0, cuota - usados - reservados), porcentaje_utilizado: porcentaje },
    descargas: { limite, ilimitadas: limite === null, consumidas,
      restantes: limite === null ? null : Math.max(0, limite - consumidas), inicio: ciclo.inicio, fin: ciclo.fin },
    alertas: { almacenamiento: alerta((usados + reservados) / cuota * 100),
      descargas: limite === null ? null : alerta(limite === 0 ? 100 : consumidas / limite * 100) },
  };
}
module.exports = { policy, cicloMensual, vigente, comprobarEspacio, resumen };
