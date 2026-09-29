const { crearTokenVerificacion } = require('../infrastructure/tokens');
const { enviarCorreoVerificacion } = require('../infrastructure/mailer');
const { BACKEND_URL } = require('../infrastructure/config');

// usuario: { id, nombre_completo, correo_electronico }
async function enviarVerificacion(usuario) {
  const token = crearTokenVerificacion(usuario.id);
  const enlace = `${BACKEND_URL}/api/auth/verificar?token=${encodeURIComponent(token)}`;
  await enviarCorreoVerificacion({
    para: usuario.correo_electronico,
    nombre: usuario.nombre_completo,
    enlace,
  });
}

module.exports = { enviarVerificacion };
