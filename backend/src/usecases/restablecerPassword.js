const { ErrorApp } = require('../domain/errores');
const { validarPassword } = require('../domain/passwordPolicy');

function crearRestablecerPassword({ repo, hashear, verificarTokenRecuperacion }) {
  async function restablecerPassword(token, nuevaPassword) {
    if (!token) {
      throw new ErrorApp('Token de recuperación inválido', 400);
    }

    validarPassword(nuevaPassword);

    let payload;

    try {
      payload = verificarTokenRecuperacion(token);
    } catch {
      throw new ErrorApp(
        'El enlace de recuperación no es válido o ya venció',
        400
      );
    }

    const passwordHash = await hashear(nuevaPassword);

    const resultado = await repo.actualizarPassword(payload.sub, passwordHash, payload.correo);

    if (!resultado) {
      if (payload.correo) throw new ErrorApp('El enlace ya no es válido. Solicita uno nuevo con tu correo actual.', 400);
      throw new ErrorApp('Usuario no encontrado', 404);
    }

    return {
      mensaje: 'Contraseña actualizada correctamente',
    };
  }
  return restablecerPassword;
}

module.exports = { crearRestablecerPassword };
