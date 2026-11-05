// Patrón Decorator: envuelve un objeto de casos de uso y le agrega
// comportamiento (registro y tiempo) sin modificar su código.
// Respeta métodos síncronos y asíncronos: no cambia lo que devuelven.
function conRegistro(casos, nombre) {
  const decorado = {};
  for (const [metodo, fn] of Object.entries(casos)) {
    if (typeof fn !== 'function') {
      decorado[metodo] = fn;
      continue;
    }
    decorado[metodo] = function (...args) {
      const inicio = Date.now();
      const ok = () => console.log(`[${nombre}.${metodo}] OK ${Date.now() - inicio} ms`);
      const fallo = (error) =>
        console.log(`[${nombre}.${metodo}] ERROR ${error?.codigo ?? error?.message} ${Date.now() - inicio} ms`);
      let resultado;
      try {
        resultado = fn.apply(this, args);
      } catch (error) {
        fallo(error);
        throw error;
      }
      if (resultado && typeof resultado.then === 'function') {
        return resultado.then(
          (valor) => { ok(); return valor; },
          (error) => { fallo(error); throw error; }
        );
      }
      ok();
      return resultado;
    };
  }
  return decorado;
}

module.exports = { conRegistro };