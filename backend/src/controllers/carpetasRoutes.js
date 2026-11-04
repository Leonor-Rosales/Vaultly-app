const { Router } = require('express');
const { ErrorApp } = require('../domain/errores');

function crearCarpetasRoutes(pool, requiereAuth) {
  const router = Router();
  router.use(requiereAuth);
  const campos = 'id,nombre,carpeta_padre_id';
  const manejar = (accion, eliminando = false) => async (req, res) => {
    try {
      await accion(req, res);
    } catch (error) {
      if (error.code === '23505') error = new ErrorApp('Ya existe una carpeta con ese nombre en el destino.', 409);
      if (error.code === '23503') error = eliminando
        ? new ErrorApp('Mueve o elimina el contenido antes de borrar la carpeta.', 409)
        : new ErrorApp('No se encontró la carpeta de destino.', 404);
      if (error.code === '22P02') error = new ErrorApp('Identificador inválido.', 400);
      if (!(error instanceof ErrorApp)) console.error('Error al administrar carpetas', error);
      res.status(error.estado || 500).json({ error: error instanceof ErrorApp ? error.message : 'No se pudo completar la operación.' });
    }
  };
  function nombre(body) {
    const valor = typeof body?.nombre === 'string' && body.nombre.trim();
    if (!valor || [...valor].length > 100) throw new ErrorApp('Escribe un nombre de hasta 100 caracteres.', 400);
    return valor;
  }
  function destino(body) {
    if (body?.padre !== null && typeof body?.padre !== 'string') throw new ErrorApp('Selecciona una ubicación.', 400);
    return body.padre;
  }
  function primero(resultado) {
    if (!resultado.rowCount) throw new ErrorApp('No se encontró el elemento.', 404);
    return resultado.rows[0];
  }
  router.get('/', manejar(async (req, res) => {
    res.json((await pool.query('SELECT ' + campos + ' FROM carpetas WHERE usuario_id=$1 ORDER BY lower(nombre),id', [req.usuario.sub])).rows);
  }));
  router.post('/', manejar(async (req, res) => {
    res.status(201).json(primero(await pool.query('INSERT INTO carpetas(usuario_id,nombre,carpeta_padre_id) VALUES($1,$2,$3) RETURNING ' + campos,
      [req.usuario.sub, nombre(req.body), destino(req.body)])));
  }));
  router.patch('/:id/nombre', manejar(async (req, res) => {
    res.json(primero(await pool.query('UPDATE carpetas SET nombre=$3 WHERE usuario_id=$1 AND id=$2 RETURNING ' + campos,
      [req.usuario.sub, req.params.id, nombre(req.body)])));
  }));
  router.patch('/archivos/:id/destino', manejar(async (req, res) => {
    res.json(primero(await pool.query('UPDATE archivos SET carpeta_id=$3 WHERE usuario_id=$1 AND id=$2 RETURNING id,carpeta_id',
      [req.usuario.sub, req.params.id, destino(req.body)])));
  }));
  router.patch('/:id/destino', manejar(async (req, res) => {
    const parametros = [req.usuario.sub, req.params.id, destino(req.body)];
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // Serializa los movimientos del mismo propietario antes de leer sus ancestros.
      await db.query('SELECT id FROM usuarios WHERE id=$1 FOR NO KEY UPDATE', [req.usuario.sub]);
      const ciclo = await db.query(`WITH RECURSIVE ancestros AS (
        SELECT id,carpeta_padre_id FROM carpetas WHERE usuario_id=$1 AND id=$3
        UNION SELECT c.id,c.carpeta_padre_id FROM carpetas c JOIN ancestros a ON c.id=a.carpeta_padre_id
      ) SELECT id FROM ancestros WHERE id=$2`, parametros);
      if (ciclo.rowCount) throw new ErrorApp('Una carpeta no puede moverse dentro de sí misma ni de sus subcarpetas.', 409);
      const carpeta = primero(await db.query('UPDATE carpetas SET carpeta_padre_id=$3 WHERE usuario_id=$1 AND id=$2 RETURNING ' + campos, parametros));
      await db.query('COMMIT');
      res.json(carpeta);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally { db.release(); }
  }));
  router.delete('/:id', manejar(async (req, res) => {
    res.json(primero(await pool.query('DELETE FROM carpetas WHERE usuario_id=$1 AND id=$2 RETURNING id', [req.usuario.sub, req.params.id])));
  }, true));
  return router;
}
module.exports = { crearCarpetasRoutes };
