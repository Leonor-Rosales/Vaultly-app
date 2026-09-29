const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Falta JWT_SECRET en backend/.env');
  process.exit(1);
}

// Secreto distinto para los tokens de verificación: uno de estos no sirve como sesión.
const SECRET_VERIFICACION = JWT_SECRET + ':verificar';

function crearTokenSesion(usuario) {
  return jwt.sign(
    { sub: usuario.id, correo: usuario.correo_electronico, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

const verificarTokenSesion = (token) => jwt.verify(token, JWT_SECRET);

function crearTokenVerificacion(idUsuario) {
  return jwt.sign({ sub: idUsuario }, SECRET_VERIFICACION, { expiresIn: '24h' });
}

const verificarTokenVerificacion = (token) => jwt.verify(token, SECRET_VERIFICACION);

module.exports = {
  crearTokenSesion,
  verificarTokenSesion,
  crearTokenVerificacion,
  verificarTokenVerificacion,
};
