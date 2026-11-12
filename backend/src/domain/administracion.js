const { ErrorApp } = require('./errores');
const { emailValido } = require('./validaciones');
const { validarPassword } = require('./passwordPolicy');
const { policy } = require('./cuotas');
const { precioPromocional } = require('./promociones');

const exigir = (ok, mensaje) => { if (!ok) throw new ErrorApp(mensaje, 400); };
function validarPlan(d = {}) {
  exigir(d !== null && typeof d === 'object' && !Array.isArray(d), 'Datos del plan inválidos');
  exigir(typeof d.nombre === 'string' && d.nombre.trim().length > 0 && d.nombre.trim().length <= 50, 'Nombre del plan requerido (máximo 50 caracteres)');
  exigir(typeof d.precio_mensual === 'number' && Number.isFinite(d.precio_mensual) && d.precio_mensual >= 0 && d.precio_mensual <= 99999999.99 && Math.abs(d.precio_mensual * 100 - Math.round(d.precio_mensual * 100)) < 0.00001, 'Precio inválido: usa hasta dos decimales');
  exigir(Number.isInteger(d.cuota_storage_gb) && d.cuota_storage_gb > 0 && Number.isSafeInteger(d.cuota_storage_gb * policy.bytesPerGB), 'Almacenamiento inválido');
  exigir(d.limite_descargas === null || (Number.isInteger(d.limite_descargas) && d.limite_descargas >= 0 && d.limite_descargas <= 2147483647), 'Límite de descargas inválido');
  exigir(typeof d.activo === 'boolean' && typeof d.permite_carpetas_publicas === 'boolean', 'Opciones booleanas inválidas');
  let promocion = {};
  if (['promocion_precio','promocion_inicio','promocion_fin','promocion_tipo','promocion_porcentaje'].some(k => d[k] !== undefined)) {
    if (d.promocion_precio === null && d.promocion_inicio === null && d.promocion_fin === null && d.promocion_tipo == null && d.promocion_porcentaje == null) promocion = { promocion_precio: null, promocion_inicio: null, promocion_fin: null, promocion_tipo: null, promocion_porcentaje: null };
    else {
      const tipo = d.promocion_tipo ?? 'FIJO';
      exigir(['FIJO','PORCENTAJE','GRATIS'].includes(tipo), 'Tipo de promoción inválido');
      if (tipo === 'PORCENTAJE') exigir(typeof d.promocion_porcentaje === 'number' && Number.isFinite(d.promocion_porcentaje) && d.promocion_porcentaje > 0 && d.promocion_porcentaje <= 100 && Math.abs(d.promocion_porcentaje * 100 - Math.round(d.promocion_porcentaje * 100)) < .00001, 'El descuento debe ser mayor a 0 y hasta 100 %, con máximo dos decimales');
      else exigir(d.promocion_porcentaje == null, 'No combines tipos de promoción');
      if (tipo === 'FIJO') exigir(typeof d.promocion_precio === 'number' && Number.isFinite(d.promocion_precio) && Math.abs(d.promocion_precio * 100 - Math.round(d.promocion_precio * 100)) < .00001, 'Indica un precio promocional válido con hasta dos decimales');
      const precio = precioPromocional({ ...d, promocion_tipo: tipo });
      exigir(Number.isFinite(precio) && precio >= 0 && precio < d.precio_mensual, 'La promoción debe reducir el precio habitual al menos Q0.01');
      const inicio = typeof d.promocion_inicio === 'string' ? Date.parse(d.promocion_inicio) : NaN;
      const fin = typeof d.promocion_fin === 'string' ? Date.parse(d.promocion_fin) : NaN;
      exigir(Number.isFinite(inicio) && Number.isFinite(fin) && inicio < fin && /(?:Z|[+-]\d\d:\d\d)$/.test(d.promocion_inicio) && /(?:Z|[+-]\d\d:\d\d)$/.test(d.promocion_fin), 'Indica inicio y fin válidos de la promoción, con zona horaria');
      exigir(d.nombre.trim().toLowerCase() !== 'free', 'Free no necesita una promoción');
      promocion = { promocion_precio: precio, promocion_inicio: new Date(inicio).toISOString(), promocion_fin: new Date(fin).toISOString(), promocion_tipo: tipo, promocion_porcentaje: tipo === 'PORCENTAJE' ? d.promocion_porcentaje : null };
    }
  }
  return { nombre: d.nombre.trim(), precio_mensual: d.precio_mensual, cuota_storage_gb: d.cuota_storage_gb, limite_descargas: d.limite_descargas, permite_carpetas_publicas: d.permite_carpetas_publicas, activo: d.activo, ...promocion };
}
function validarAdministrador(d = {}, crear = false) {
  exigir(d !== null && typeof d === 'object' && !Array.isArray(d), 'Datos del administrador inválidos');
  exigir(typeof d.nombre_completo === 'string' && d.nombre_completo.trim().length > 0 && d.nombre_completo.trim().length <= 150, 'Nombre requerido (máximo 150 caracteres)');
  exigir(typeof d.correo_electronico === 'string' && d.correo_electronico.trim().length <= 150 && emailValido(d.correo_electronico.trim()), 'Correo no válido');
  exigir(typeof d.activo === 'boolean', 'Estado inválido');
  if (crear) validarPassword(d.password);
  return { nombre_completo: d.nombre_completo.trim(), correo_electronico: d.correo_electronico.trim().toLowerCase(), estado_cuenta: d.activo ? 'ACTIVO' : 'BLOQUEADO' };
}
function protegerAcceso(actor, id, activo, cantidad) {
  if (!activo && cantidad <= 1) throw new ErrorApp('No puedes desactivar al último administrador activo', 409);
  if (!activo && actor === id) throw new ErrorApp('No puedes desactivar tu propia cuenta', 409);
}
function protegerPlan(anterior, nuevo, usado) {
  if (anterior.nombre === 'Free' && (nuevo.nombre !== 'Free' || !nuevo.activo || nuevo.precio_mensual !== 0)) throw new ErrorApp('Free debe conservar su nombre, precio cero y estado activo', 409);
  const condiciones = ['nombre', 'precio_mensual', 'cuota_storage_gb', 'limite_descargas', 'permite_carpetas_publicas'];
  if (usado && condiciones.some(k => k === 'precio_mensual' ? Number(anterior[k]) !== nuevo[k] : anterior[k] !== nuevo[k])) throw new ErrorApp('Este plan tiene suscripciones. Crea otro plan para ofrecer condiciones diferentes; puedes cambiar su estado.', 409);
}
module.exports = { validarPlan, validarAdministrador, protegerAcceso, protegerPlan };
