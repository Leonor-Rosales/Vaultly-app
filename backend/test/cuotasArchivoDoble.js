const { ErrorApp } = require('../src/domain/errores');
// Doble explícito para conservar las pruebas unitarias del módulo de archivos.
// La política y la concurrencia se verifican aparte con PostgreSQL real.
function cuotasArchivoDoble(repositorio, almacenamiento) {
  const reservas = new Map();
  return {
    reservarSubida: async (_u, nombre) => { reservas.set(nombre, nombre); return nombre; },
    ejecutarSubida: async (_u, id, fn) => { const r = await fn(repositorio); reservas.delete(id); return r; },
    compensarSubida: async (_u, id) => { if (reservas.has(id)) { await almacenamiento.eliminar(id); reservas.delete(id); } },
    eliminar: async (_u, fn) => fn(repositorio),
    reservarDescarga: async (u, id) => {
      const archivo = await (repositorio.buscarDescargable || repositorio.buscarPorIdYUsuario)(id, u);
      if (!archivo) throw new ErrorApp('Archivo no encontrado', 404);
      return { id, archivo };
    },
    iniciarDescarga: async () => {},
    devolverDescarga: async () => {},
  };
}
module.exports = { cuotasArchivoDoble };
