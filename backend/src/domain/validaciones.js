const { ErrorApp } = require('./errores');

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const normalizarCorreo = (c) => String(c || '').trim().toLowerCase();

function validarRegistro({ nombre_completo, correo_electronico, password, confirmar_password }) {
  if (!nombre_completo || !correo_electronico || !password) {
    throw new ErrorApp('Nombre, correo y contraseña son obligatorios', 400);
  }
  if (!emailValido(correo_electronico)) {
    throw new ErrorApp('Correo no válido', 400);
  }
  if (password.length < 8) {
    throw new ErrorApp('La contraseña debe tener al menos 8 caracteres', 400);
  }
  if (confirmar_password !== undefined && confirmar_password !== password) {
    throw new ErrorApp('Las contraseñas no coinciden', 400);
  }
}

module.exports = { emailValido, normalizarCorreo, validarRegistro };
