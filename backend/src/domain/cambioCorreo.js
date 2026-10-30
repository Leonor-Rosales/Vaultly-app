const { ErrorApp } = require('./errores');
const { emailValido } = require('./validaciones');
const emailPolicy = require('../../../shared/email-policy.json');
const POLITICA = Object.freeze({ minutos: 10, intentos: 5, esperaSegundos: 60, enviosHora: 5, fallosPassword: 5, ventanaPasswordMinutos: 15 });
function validarSolicitud(datos) {
  if (!datos || typeof datos.correo !== 'string' || datos.correo.trim().length > 150 || !emailValido(datos.correo.trim())) throw new ErrorApp('Introduce un correo válido', 400, 'CORREO_INVALIDO');
  const correo = datos.correo.trim().toLowerCase();
  if (correo.split('@')[0].length > 64 || !new RegExp(emailPolicy.pattern).test(correo)) throw new ErrorApp('Introduce una dirección de correo válida, por ejemplo nombre@dominio.com.', 400, 'CORREO_INVALIDO');
  const dominio = correo.split('@')[1];
  const sugerido = Object.hasOwn(emailPolicy.corrections, dominio) ? emailPolicy.corrections[dominio] : null;
  if (sugerido) throw new ErrorApp(`Revisa el dominio: escribiste ${dominio}. ¿Querías decir ${sugerido}? Corrige la dirección antes de continuar.`, 400, 'CORREO_DOMINIO');
  if (typeof datos.password !== 'string' || !datos.password || Buffer.byteLength(datos.password) > 72) throw new ErrorApp('Introduce tu contraseña actual', 400, 'PASSWORD_INVALIDA');
  return { correo: datos.correo.trim().toLowerCase(), password: datos.password };
}
function resumenSolicitud(s, ahora) {
  if (!s?.solicitud_id || ['CONSUMIDO', 'CANCELADO'].includes(s.estado)) return null;
  return { id: s.solicitud_id, correo: s.correo_nuevo, estado: s.estado, vence_en: s.vence_en,
    reenviar_desde: s.reenviar_desde, intentos_restantes: Math.max(0, POLITICA.intentos - s.intentos),
    vencido: new Date(s.vence_en) <= ahora };
}
module.exports = { POLITICA, validarSolicitud, resumenSolicitud };
