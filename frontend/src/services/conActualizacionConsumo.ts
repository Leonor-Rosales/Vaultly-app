// Decorator funcional: conserva argumentos y resultado, añadiendo el refresco de consumo.
export function conActualizacionConsumo<Argumentos extends unknown[], Resultado>(
  operacion: (...argumentos: Argumentos) => Promise<Resultado>,
  actualizar: () => Promise<unknown>,
): (...argumentos: Argumentos) => Promise<Resultado> {
  return async (...argumentos) => {
    try {
      return await operacion(...argumentos);
    } finally {
      // Un fallo del refresco no debe ocultar el resultado ni el error de la operación.
      try { await actualizar(); } catch { /* El consumo se podrá consultar nuevamente. */ }
    }
  };
}
