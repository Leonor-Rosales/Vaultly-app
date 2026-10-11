const Module = require('node:module');
const fs = require('node:fs');

// Carga el código real, sustituyendo únicamente los adaptadores indicados.
// No toca require.cache ni inicializa conexiones externas.
module.exports = function loadWith(filename, substitutes) {
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(require('node:path').dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(substitutes, id) ? substitutes[id] : original(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports;
};
