const { ESTADO } = require('../domain/estadoCuenta');
const { ErrorApp } = require('../domain/errores');
const { normalizarCorreo } = require('../domain/validaciones');
const repo = require('../infrastructure/usuarioRepositorio');
const { comparar } = require('../infrastructure/contrasenas');
const { crearTokenSesion } = require('../infrastructure/tokens');

async function iniciarSesion({ correo_electronico, password } = {}) {
  if (!correo_electronico || !password) {
    throw new ErrorApp('Correo y contraseña son obligatorios', 400);
  }

  const fila = await repo.buscarPorCorreoConRol(
    normalizarCorreo(correo_electronico)
  );

  // El correo no está registrado
  if (!fila) {
    throw new ErrorApp(
      'Este correo no está registrado en Vaultly',
      404,
      'USUARIO_NO_REGISTRADO'
    );
  }

  // El correo existe, pero la contraseña no coincide
  const ok = await comparar(password, fila.password_hash);

  if (!ok) {
    throw new ErrorApp('Correo o contraseña incorrectos', 401);
  }

  if (fila.estado_cuenta === ESTADO.INACTIVO) {
    throw new ErrorApp(
      'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
      403,
      'CORREO_NO_CONFIRMADO'
    );
  }

  if (fila.estado_cuenta !== ESTADO.ACTIVO) {
    throw new ErrorApp('Tu cuenta no está activa', 403);
  }

  const usuario = {
    id: fila.id,
    nombre_completo: fila.nombre_completo,
    correo_electronico: fila.correo_electronico,
    rol: fila.rol,
  };

  return {
    token: crearTokenSesion(usuario),
    usuario,
  };
}
module.exports = { iniciarSesion };