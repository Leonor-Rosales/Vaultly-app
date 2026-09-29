const { ErrorApp } = require('../domain/errores');
const { hashear } = require('../infrastructure/contrasenas');
const {
  verificarTokenRecuperacion,
} = require('../infrastructure/tokens');
const pool = require('../infrastructure/db');

async function restablecerPassword(token, nuevaPassword) {
  if (!token) {
    throw new ErrorApp('Token de recuperación inválido', 400);
  }

  if (!nuevaPassword || typeof nuevaPassword !== 'string') {
    throw new ErrorApp('La contraseña es obligatoria', 400);
  }

  if (nuevaPassword.length < 8) {
    throw new ErrorApp(
      'La contraseña debe tener al menos 8 caracteres',
      400
    );
  }

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

  const resultado = await pool.query(
    `UPDATE usuarios
     SET password_hash = $1
     WHERE id = $2
     RETURNING id`,
    [passwordHash, payload.sub]
  );

  if (resultado.rowCount === 0) {
    throw new ErrorApp('Usuario no encontrado', 404);
  }

  return {
    mensaje: 'Contraseña actualizada correctamente',
  };
}

module.exports = {
  restablecerPassword,
};