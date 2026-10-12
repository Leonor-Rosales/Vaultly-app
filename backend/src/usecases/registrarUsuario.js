const { randomUUID } = require('crypto');
const { ESTADO } = require('../domain/estadoCuenta');
const { ErrorApp } = require('../domain/errores');
const { validarRegistro, normalizarCorreo } = require('../domain/validaciones');

function crearRegistrarUsuario({ repo, hashear, enviarVerificacion }) {
  async function registrarUsuario(datos) {
    validarRegistro(datos);

    // Todo registro público entra con el rol CLIENTE (nunca ADMIN)
    const rol = await repo.buscarRolPorNombre('CLIENTE');
    if (!rol) {
      console.error("No existe el rol 'CLIENTE' en la tabla roles");
      throw new ErrorApp('Error interno del servidor', 500);
    }

    const passwordHash = await hashear(datos.password);

    const usuario = await repo.crearUsuario({
      id: randomUUID(),
      rolId: rol.id,
      nombreCompleto: datos.nombre_completo.trim(),
      correo: normalizarCorreo(datos.correo_electronico),
      passwordHash,
      estado: ESTADO.INACTIVO, // pendiente hasta confirmar el correo
    });

    let correoEnviado = true;
    try {
      await enviarVerificacion(usuario);
    } catch (err) {
      correoEnviado = false;
      console.error('No se pudo enviar el correo de verificación:', err.message);
    }

    return {
      correo_enviado: correoEnviado,
      mensaje: correoEnviado
        ? 'Cuenta creada. Revisa tu correo para activarla.'
        : 'Cuenta creada, pero no se pudo enviar el correo. Solicita el reenvío.',
    };
  }
  return registrarUsuario;
}

module.exports = { crearRegistrarUsuario };
