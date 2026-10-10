
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { requiereAuth } = require('./middleware/auth');
const {
  minio,
  MINIO_BUCKET,
  asegurarBucket,
} = require('../infrastructure/minioCliente');
const archivoRepositorio = require('../infrastructure/archivoRepositorio');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.use(requiereAuth);

function obtenerUsuarioId(req) {
  return req.usuario.sub;
}

// Listar archivos del usuario autenticado.
router.get('/', async (req, res) => {
  try {
    const archivos = await archivoRepositorio.listarPorUsuario(
      obtenerUsuarioId(req)
    );
    res.json(archivos);
  } catch (error) {
    console.error('Error al listar archivos:', error);
    res.status(500).json({ error: 'No se pudieron listar los archivos' });
  }
});

// Subir un archivo a MinIO y guardar sus metadatos.
router.post('/', upload.single('archivo'), async (req, res) => {
  let objetoCreado = false;
  let nombreObjeto;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar un archivo' });
    }
    const esPublica = req.body?.es_publica === 'true';

    const usuarioId = obtenerUsuarioId(req);
    const nombreOriginal = path.basename(req.file.originalname).slice(0, 255);

    if (!nombreOriginal.trim()) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    nombreObjeto = `${usuarioId}/${crypto.randomUUID()}`;
    const tipoMime = (req.file.mimetype || 'application/octet-stream').slice(0, 100);

    await asegurarBucket();

    await minio.putObject(
      MINIO_BUCKET,
      nombreObjeto,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': tipoMime }
    );
    objetoCreado = true;

    const archivo = await archivoRepositorio.registrar({
      usuarioId,
      nombreOriginal,
      nombreObjeto,
      rutaMinio: `${MINIO_BUCKET}/${nombreObjeto}`,
      tamanioBytes: req.file.size,
      tipoMime,
      esPublica,
    });

    return res.status(201).json(archivo);
  } catch (error) {
    if (objetoCreado && nombreObjeto) {
      try {
        await minio.removeObject(MINIO_BUCKET, nombreObjeto);
      } catch (errorLimpieza) {
        console.error('No se pudo limpiar el objeto:', errorLimpieza);
      }
    }

    console.error('Error al subir archivo:', error);
    return res.status(500).json({ error: 'No se pudo subir el archivo' });
  }
});


router.patch('/:id/visibilidad', async (req, res) => {
  try {
    const esPublica = req.body?.es_publica;

    if (typeof esPublica !== 'boolean') {
      return res.status(400).json({
        error: 'La visibilidad debe ser true o false',
      });
    }

    const archivo = await archivoRepositorio.actualizarVisibilidad(
      req.params.id,
      req.usuario.sub,
      esPublica
    );

    if (!archivo) {
      return res.status(404).json({
        error: 'Archivo no encontrado',
      });
    }

    return res.json(archivo);
  } catch (error) {
    console.error('Error al cambiar la visibilidad:', error);

    return res.status(500).json({
      error: 'No se pudo cambiar la visibilidad del archivo',
    });
  }
});


// Descargar un archivo propio.
router.get('/:id/descargar', async (req, res) => {
  try {
    const archivo = await archivoRepositorio.buscarPorIdYUsuario(
      req.params.id,
      obtenerUsuarioId(req)
    );

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const stream = await minio.getObject(MINIO_BUCKET, archivo.nombre_objeto_minio);

    res.setHeader('Content-Type', archivo.tipo_mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre_original)}`
    );

    stream.on('error', (error) => {
      console.error('Error al leer archivo:', error);
      if (!res.headersSent) res.status(500).end();
      else res.destroy(error);
    });

    stream.pipe(res);
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'No se pudo descargar el archivo' });
    }
  }
});

// Eliminar archivo propio.
router.delete('/:id', async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const archivo = await archivoRepositorio.buscarPorIdYUsuario(
      req.params.id,
      usuarioId
    );

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    await minio.removeObject(MINIO_BUCKET, archivo.nombre_objeto_minio);

    const eliminado = await archivoRepositorio.eliminarRegistro(
      archivo.id,
      usuarioId
    );

    if (!eliminado) {
      return res.status(500).json({
        error: 'El objeto se eliminó, pero no se pudo eliminar su registro',
      });
    }

    return res.json({ mensaje: 'Archivo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    return res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

module.exports = router;
