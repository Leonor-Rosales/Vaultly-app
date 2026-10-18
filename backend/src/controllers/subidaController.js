
// POST /api/biblioteca/subir  (multipart/form-data)
//   archivo      -> el archivo (obligatorio)
//   es_publica   -> 'true' | 'false' (por defecto 'false')
//   etiquetas    -> JSON '["mate","pdf"]' o texto 'mate,pdf' (opcional, máx. 10)
//
// Requiere:  npm install multer

const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const pool = require('../infrastructure/db');
const { crearArchivoRepositorio } = require('../infrastructure/archivoRepositorio');
const { minioClient, BUCKET } = require('../infrastructure/minioCliente');
 
const MAX_BYTES = Number(process.env.MAX_SUBIDA_BYTES) || 1024 * 1024 * 1024;
const MAX_ETIQUETAS = 10;
const GB = 1024 ** 3;
 
const repo = crearArchivoRepositorio(pool);
const subir = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => cb(null, `vaultly-${crypto.randomUUID()}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single('archivo');
 
class ErrorPublico extends Error {
  constructor(mensaje, status = 400, codigo = 'PARAMETRO_INVALIDO') {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}
 
let bucketListo = false;
async function asegurarBucket() {
  if (bucketListo) return;
  if (!(await minioClient.bucketExists(BUCKET))) await minioClient.makeBucket(BUCKET);
  bucketListo = true;
}
 
function leerEtiquetas(crudo) {
  if (crudo === undefined || crudo === '') return [];
  let lista;
  try {
    lista = crudo.trim().startsWith('[') ? JSON.parse(crudo) : crudo.split(',');
  } catch {
    throw new ErrorPublico('El campo etiquetas no es válido');
  }
  if (!Array.isArray(lista)) throw new ErrorPublico('El campo etiquetas no es válido');
  const limpias = [...new Set(lista.map((e) => String(e).trim()).filter(Boolean))];
  if (limpias.length > MAX_ETIQUETAS) throw new ErrorPublico(`Máximo ${MAX_ETIQUETAS} etiquetas`);
  if (limpias.some((e) => e.length > 30)) throw new ErrorPublico('Cada etiqueta admite máximo 30 caracteres');
  return limpias;
}
 
async function verificarCuota(usuarioId, bytes) {
  const { rows: [plan] } = await pool.query(
    `SELECT p.cuota_storage_gb
       FROM suscripciones s JOIN planes p ON p.id = s.plan_id
      WHERE s.usuario_id = $1 AND s.estado = 'ACTIVA'
        AND s.fecha_inicio <= now() AND s.fecha_fin > now()`,
    [usuarioId],
  );
  if (!plan) throw new ErrorPublico('No tienes una suscripción activa', 403, 'SIN_SUSCRIPCION');
 
  const { rows: [uso] } = await pool.query(
    `SELECT (SELECT COALESCE(SUM(tamanio_bytes), 0) FROM archivos WHERE usuario_id = $1)
          + (SELECT COALESCE(SUM(bytes), 0) FROM reservas_subida
              WHERE usuario_id = $1 AND vence_en > now()) AS usados`,
    [usuarioId],
  );
  if (BigInt(uso.usados) + BigInt(bytes) > BigInt(plan.cuota_storage_gb) * BigInt(GB)) {
    throw new ErrorPublico('No tienes espacio suficiente en tu plan', 413, 'CUOTA_EXCEDIDA');
  }
}
 
function crearSubidaRoutes(requireAuth) {
const router = Router();
 
router.post('/subir', requireAuth, (req, res) => {
  subir(req, res, async (errSubida) => {
    const archivo = req.file;
    const limpiarTemporal = () => archivo && fs.promises.unlink(archivo.path).catch(() => {});
    let nombreObjeto = null;
    let guardadoEnMinio = false;
    try {
      if (errSubida) {
        if (errSubida.code === 'LIMIT_FILE_SIZE') {
          throw new ErrorPublico('El archivo supera el tamaño máximo permitido', 413, 'ARCHIVO_MUY_GRANDE');
        }
        throw new ErrorPublico('No se pudo recibir el archivo');
      }
      if (!archivo) throw new ErrorPublico('Falta el campo archivo');
 
      const usuarioId = req.usuario.sub;
      const esPublica = req.body.es_publica === 'true';
      const etiquetas = leerEtiquetas(req.body.etiquetas);
      // multer entrega el nombre como latin1; se recupera el UTF-8 original.
      const nombreOriginal = Buffer.from(archivo.originalname, 'latin1').toString('utf8').slice(0, 255);
      const tipoMime = (archivo.mimetype || 'application/octet-stream').slice(0, 100);
 
      await verificarCuota(usuarioId, archivo.size);
      await asegurarBucket();
 
      nombreObjeto = `${usuarioId}/${crypto.randomUUID()}${path.extname(nombreOriginal).slice(0, 20)}`;
      await minioClient.fPutObject(BUCKET, nombreObjeto, archivo.path, { 'Content-Type': tipoMime });
      guardadoEnMinio = true;
 
      const registro = await repo.registrar({
        usuarioId,
        nombreOriginal,
        nombreObjeto,
        rutaMinio: `${BUCKET}/${nombreObjeto}`,
        tamanioBytes: archivo.size,
        tipoMime,
        esPublica,
        etiquetas,
      });
      res.status(201).json(registro);
    } catch (err) {
      // Si falló el registro en la base, no dejar el archivo huérfano en MinIO.
      if (guardadoEnMinio) await minioClient.removeObject(BUCKET, nombreObjeto).catch(() => {});
      if (err instanceof ErrorPublico) {
        res.status(err.status).json({ error: err.message, codigo: err.codigo });
      } else {
        console.error('Error al subir archivo:', err);
        res.status(500).json({ error: 'Error interno del servidor', codigo: 'ERROR_INTERNO' });
      }
    } finally {
      await limpiarTemporal();
    }
  });
});
 
return router;
}
 
module.exports = crearSubidaRoutes;
 
// En server.js (junto al router de biblioteca):
//   const crearSubidaRoutes = require('./controllers/subidaController');
//   app.use('/api/biblioteca', crearSubidaRoutes(requireAuth));