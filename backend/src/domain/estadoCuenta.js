// Estados permitidos en la BD (CHECK de usuarios.estado_cuenta)
const ESTADO = {
  ACTIVO: 'ACTIVO',
  INACTIVO: 'INACTIVO', // se usa como "pendiente de confirmar el correo"
  BLOQUEADO: 'BLOQUEADO',
};

module.exports = { ESTADO };
