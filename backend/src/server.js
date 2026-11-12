require('dotenv').config();
const { app, servicios } = require('./app');

// Vercel importa la aplicación; el modo local conserva su servidor y mantenimiento.
if (require.main === module) {
  const { PORT, FRONTEND_URL } = require('./infrastructure/config');
  const { crearTareasMantenimiento, iniciarMantenimientoLocal } = require('./infrastructure/mantenimiento');
  const { limpiarPlanesInactivos } = require('./infrastructure/limpiezaPlanes');
  const { enviarAvisosRetiro } = require('./infrastructure/enviarAvisosRetiro');
  const correoRetiro = require('./infrastructure/correoRetiroPlan').crearCorreoRetiroPlan(
    require('./infrastructure/mailer').enviarMensaje, FRONTEND_URL,
  );
  iniciarMantenimientoLocal(crearTareasMantenimiento({
    ...servicios, limpiarPlanesInactivos, enviarAvisosRetiro, correoRetiro,
  }));
  app.listen(PORT, () => console.log(`Backend en http://localhost:${PORT}`));
}

module.exports = app;
