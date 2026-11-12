function precioPromocional(plan) {
  if (plan.promocion_tipo === 'GRATIS') return 0;
  if (plan.promocion_tipo === 'PORCENTAJE') {
    const centavos = Math.round(Number(plan.precio_mensual) * 100);
    const porcentaje = Math.round(Number(plan.promocion_porcentaje) * 100);
    return Math.round(centavos * (10000 - porcentaje) / 10000) / 100;
  }
  return Number(plan.promocion_precio);
}
function precioContratacion(plan, ahora) {
  const vigente = (plan.promocion_tipo != null || plan.promocion_precio != null) && +new Date(plan.promocion_inicio) <= +ahora && +ahora < +new Date(plan.promocion_fin);
  return { precio: vigente ? precioPromocional(plan) : Number(plan.precio_mensual), promocion: vigente };
}
module.exports = { precioContratacion, precioPromocional };
