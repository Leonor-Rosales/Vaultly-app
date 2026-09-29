const { FRONTEND_URL } = require('../infrastructure/config');
const {
  enviarCorreoRecuperacion: enviarCorreo,
} = require('../infrastructure/mailer');

async function enviarCorreoRecuperacion({ para, nombre, token }) {
  const enlace =
    `${FRONTEND_URL}/restablecer?token=${encodeURIComponent(token)}`;

  await enviarCorreo({
    para,
    nombre,
    enlace,
  });
}

module.exports = { enviarCorreoRecuperacion };