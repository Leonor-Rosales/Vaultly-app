const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('Falta JWT_SECRET en backend/.env');
  process.exit(1);
}

// Secreto distinto para los tokens de verificación
const SECRET_VERIFICACION = JWT_SECRET + ':verificar';

// Secreto distinto para recuperación de contraseña
const SECRET_RECUPERACION = JWT_SECRET + ':recuperacion';

function crearTokenSesion(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      correo: usuario.correo_electronico,
      rol: usuario.rol,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

const verificarTokenSesion = (token) =>
  jwt.verify(token, JWT_SECRET);

function crearTokenVerificacion(idUsuario) {
  return jwt.sign(
    { sub: idUsuario },
    SECRET_VERIFICACION,
    { expiresIn: '24h' }
  );
}

const verificarTokenVerificacion = (token) =>
  jwt.verify(token, SECRET_VERIFICACION);

function crearTokenRecuperacion(idUsuario, correo) {
  return jwt.sign(
    { sub: idUsuario, correo },
    SECRET_RECUPERACION,
    { expiresIn: '1h' }
  );
}

function verificarTokenRecuperacion(token) {
  return jwt.verify(token, SECRET_RECUPERACION);
}

module.exports = {
  crearTokenSesion,
  verificarTokenSesion,
  crearTokenVerificacion,
  verificarTokenVerificacion,
  crearTokenRecuperacion,
  verificarTokenRecuperacion,
};
