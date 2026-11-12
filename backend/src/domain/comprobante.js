// Solo datos del usuario y plan leídos por el servidor dentro de la compra.
function datosComprobante(cliente, plan, inicio, fin) {
  return {
    version: 1, moneda: 'GTQ',
    cliente: { nombre: cliente.nombre_completo, correo: cliente.correo_electronico },
    almacenamientoGb: Number(plan.cuota_storage_gb),
    descargasMensuales: plan.limite_descargas === null ? null : Number(plan.limite_descargas),
    inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString(),
  };
}
module.exports = { datosComprobante };
