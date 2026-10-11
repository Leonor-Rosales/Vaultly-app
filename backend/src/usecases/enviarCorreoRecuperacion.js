
function crearEnviarCorreoRecuperacion({ enviarCorreo, frontendUrl }) {
  async function enviarCorreoRecuperacion({ para, nombre, token }) {
    const enlace =
      `${frontendUrl}/restablecer?token=${encodeURIComponent(token)}`;

    await enviarCorreo({
      para,
      nombre,
      enlace,
    });
  }
  return enviarCorreoRecuperacion;
}

module.exports = { crearEnviarCorreoRecuperacion };
