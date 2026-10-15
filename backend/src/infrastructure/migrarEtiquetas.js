const { normalizarEtiquetas } = require('../domain/etiquetas');

async function migrarEtiquetas(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE etiquetas, archivo_etiquetas IN ACCESS EXCLUSIVE MODE');
    const { rows } = await client.query('SELECT id,nombre FROM etiquetas ORDER BY id');
    const grupos = new Map();
    for (const fila of rows) {
      const [nombre] = normalizarEtiquetas([fila.nombre]);
      if (!grupos.has(nombre)) grupos.set(nombre, []);
      grupos.get(nombre).push(fila.id);
    }
    // Primero consolidar y después renombrar: evita colisiones con el UNIQUE actual.
    for (const ids of grupos.values()) {
      for (const id of ids.slice(1)) {
        await client.query(`INSERT INTO archivo_etiquetas(archivo_id,etiqueta_id)
          SELECT archivo_id,$1 FROM archivo_etiquetas WHERE etiqueta_id=$2 ON CONFLICT DO NOTHING`, [ids[0], id]);
        await client.query('DELETE FROM etiquetas WHERE id=$1', [id]);
      }
    }
    for (const [nombre, ids] of grupos) await client.query('UPDATE etiquetas SET nombre=$1 WHERE id=$2', [nombre, ids[0]]);
    const { rowCount } = await client.query('SELECT archivo_id FROM archivo_etiquetas GROUP BY archivo_id HAVING count(*)>5');
    if (rowCount) throw new Error('Existen archivos con más de 5 etiquetas; resolver antes de migrar. No se modificaron etiquetas.');
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='etiquetas'::regclass AND conname='etiquetas_longitud') THEN
        ALTER TABLE etiquetas ADD CONSTRAINT etiquetas_longitud CHECK(char_length(nombre) BETWEEN 1 AND 30);
      END IF;
    END $$`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
module.exports = { migrarEtiquetas };
