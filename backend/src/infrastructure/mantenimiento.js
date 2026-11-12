// Las tareas pueden invocarse sin iniciar temporizadores. La exclusión entre
// procesos sigue siendo responsabilidad de los repositorios PostgreSQL.
function crearTareasMantenimiento({
  cuotas, papelera, pool, limpiarPlanesInactivos, enviarAvisosRetiro, correoRetiro,
  registrar = console.log, registrarError = console.error,
}) {
  function tarea(mensaje, ejecutar) {
    let activa = false;
    return async () => {
      if (activa) return;
      activa = true;
      try { return await ejecutar(); }
      catch (error) { registrarError(mensaje, error.message); }
      finally { activa = false; }
    };
  }

  return {
    limpiarPapelera: tarea('No se pudo limpiar la papelera:', () => papelera.limpiar()),
    recuperarReservas: tarea('No se pudieron recuperar reservas:', async () => {
      const resultado = await cuotas.recuperarReservas();
      if (resultado.fallos) registrarError('Reservas pendientes de recuperación:', resultado.fallos);
      return resultado;
    }),
    limpiarPlanes: tarea('Limpieza de planes pendiente:', async () => {
      const resultado = await limpiarPlanesInactivos(pool);
      if (resultado.archivados || resultado.eliminados) registrar('Limpieza de planes:', resultado);
      return resultado;
    }),
    procesarCorreosRetiro: tarea('No se pudieron procesar los avisos de retiro:', async () => {
      const resultado = await enviarAvisosRetiro(pool, correoRetiro);
      if (resultado.fallos) registrarError('Correos de retiro pendientes de reintento:', resultado.fallos);
      return resultado;
    }),
  };
}

function iniciarMantenimientoLocal(tareas, programar = setInterval) {
  const frecuencias = {
    limpiarPapelera: 60000,
    recuperarReservas: 60000,
    limpiarPlanes: 3600000,
    procesarCorreosRetiro: 60000,
  };
  const relojes = Object.entries(frecuencias).map(([nombre, intervalo]) => {
    const reloj = programar(tareas[nombre], intervalo);
    reloj.unref();
    void tareas[nombre]();
    return reloj;
  });
  return () => relojes.forEach(clearInterval);
}

module.exports = { crearTareasMantenimiento, iniciarMantenimientoLocal };
