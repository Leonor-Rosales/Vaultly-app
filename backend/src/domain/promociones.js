function precioContratacion(plan, ahora) {
  const vigente = plan.promocion_precio != null && +new Date(plan.promocion_inicio) <= +ahora && +ahora < +new Date(plan.promocion_fin);
  return { precio: Number(vigente ? plan.promocion_precio : plan.precio_mensual), promocion: vigente };
}
module.exports = { precioContratacion };
