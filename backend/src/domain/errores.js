// Error de negocio con el código HTTP que debe recibir el cliente
class ErrorApp extends Error {
  constructor(mensaje, estado = 500, codigo) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.codigo = codigo;
  }
}

module.exports = { ErrorApp };
