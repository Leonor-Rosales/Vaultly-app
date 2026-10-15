const { normalizarEtiquetas: normalizar } = require('../../../shared/etiquetas.mjs');
const { ErrorApp } = require('./errores');
function normalizarEtiquetas(entrada) {
  try { return normalizar(entrada); }
  catch (error) { throw new ErrorApp(error.message, 400); }
}
module.exports = { normalizarEtiquetas };
