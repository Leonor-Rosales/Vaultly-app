const multer = require('multer');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');
const { ErrorApp } = require('../domain/errores');
const { maxFileBytes, maxFileLabel } = require('../../../shared/upload-policy.json');

function crearRecepcionArchivo({ directorioTemporal = tmpdir() } = {}) {
  const recibir = multer({
    storage: multer.diskStorage({
      destination: directorioTemporal,
      filename: (_req, _file, callback) => callback(null, `vaultly-upload-${randomUUID()}`),
    }),
    limits: { fileSize: maxFileBytes, files: 1 },
  }).single('archivo');

  return (req, res) => new Promise((resolve, reject) => {
    recibir(req, res, error => {
      if (!error) return resolve();
      if (error instanceof multer.MulterError) {
        return reject(error.code === 'LIMIT_FILE_SIZE'
          ? new ErrorApp(`El archivo supera el tamaño máximo de ${maxFileLabel}.`, 413, 'ARCHIVO_DEMASIADO_GRANDE')
          : new ErrorApp('La carga debe contener un solo archivo en el campo archivo y datos válidos.', 400, error.code));
      }
      reject(error);
    });
  });
}

module.exports = { crearRecepcionArchivo };
