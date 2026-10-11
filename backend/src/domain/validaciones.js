const { ErrorApp } = require('./errores');
const { validarPassword } = require('./passwordPolicy');

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const normalizarCorreo = (c) => String(c || '').trim().toLowerCase();

function validarRegistro({ nombre_completo, correo_electronico, password, confirmar_password }) {
  if (!nombre_completo || !correo_electronico || !password) {
    throw new ErrorApp('Nombre, correo y contraseña son obligatorios', 400);
  }
  if (!emailValido(correo_electronico)) {
    throw new ErrorApp('Correo no válido', 400);
  }
  validarPassword(password);
  if (confirmar_password !== undefined && confirmar_password !== password) {
    throw new ErrorApp('Las contraseñas no coinciden', 400);
  }
}

module.exports = { emailValido, normalizarCorreo, validarRegistro };
