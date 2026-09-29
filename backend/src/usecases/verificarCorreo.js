const { ESTADO } = require('../domain/estadoCuenta');
const repo = require('../infrastructure/usuarioRepositorio');
const { verificarTokenVerificacion } = require('../infrastructure/tokens');

// Devuelve: 'verificado' | 'enlace_invalido' | 'cuenta_no_verificable'
async function verificarCorreo(token) {
  let payload;
  try {
    payload = verificarTokenVerificacion(token);
  } catch {
    return 'enlace_invalido';
  }

  const cambio = await repo.activarSiPendiente(payload.sub, ESTADO.ACTIVO, ESTADO.INACTIVO);
  if (cambio) return 'verificado';

  // Puede que ya estuviera activa (enlace usado dos veces) o que esté bloqueada
  const estado = await repo.obtenerEstado(payload.sub);
  return estado === ESTADO.ACTIVO ? 'verificado' : 'cuenta_no_verificable';
}

module.exports = { verificarCorreo };
