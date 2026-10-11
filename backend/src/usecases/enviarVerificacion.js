
// usuario: { id, nombre_completo, correo_electronico }
function crearEnviarVerificacion({ crearTokenVerificacion, enviarCorreoVerificacion, backendUrl }) {
  async function enviarVerificacion(usuario) {
    const token = crearTokenVerificacion(usuario.id);
    const enlace = `${backendUrl}/api/auth/verificar?token=${encodeURIComponent(token)}`;
    await enviarCorreoVerificacion({
      para: usuario.correo_electronico,
      nombre: usuario.nombre_completo,
      enlace,
    });
  }
  return enviarVerificacion;
}

module.exports = { crearEnviarVerificacion };
