const { ESTADO } = require('../domain/estadoCuenta');

// Devuelve: 'verificado' | 'enlace_invalido' | 'cuenta_no_verificable'
function crearVerificarCorreo({ repo, verificarTokenVerificacion }) {
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
  return verificarCorreo;
}

module.exports = { crearVerificarCorreo };
