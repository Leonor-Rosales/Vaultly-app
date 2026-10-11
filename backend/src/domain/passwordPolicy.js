const policy = require('../../../shared/password-policy.json');
const { ErrorApp } = require('./errores');

function validarPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new ErrorApp('La contraseña es obligatoria', 400);
  }
  if (Buffer.byteLength(password, 'utf8') > policy.maxBytes) {
    throw new ErrorApp(`La contraseña no puede superar ${policy.maxBytes} bytes UTF-8; los acentos y emojis pueden ocupar varios bytes`, 400);
  }
  if ([...password].length < policy.minLength) {
    throw new ErrorApp(`La contraseña debe tener al menos ${policy.minLength} caracteres`, 400);
  }
  const pendientes = policy.rules.filter(({ pattern }) => !new RegExp(pattern, 'u').test(password));
  if (pendientes.length) {
    throw new ErrorApp(`La contraseña debe cumplir: ${pendientes.map(({ label }) => label.toLowerCase()).join('; ')}`, 400);
  }
}

module.exports = { validarPassword };
