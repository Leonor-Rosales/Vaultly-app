// Consultas de la biblioteca pública. Solo lee archivos con es_publica = TRUE.
const pool = require('./db');

const POR_PAGINA = 12;

// Clasificación por prioridad (igual que el documento del frontend).
const TIPO_SQL = `CASE
  WHEN a.tipo_mime ILIKE 'image/%' THEN 'imagenes'
  WHEN a.tipo_mime ILIKE 'video/%' THEN 'videos'
  WHEN a.tipo_mime ILIKE 'audio/%' THEN 'audio'
  WHEN a.tipo_mime ~* '(zip|compressed|archive|gzip|tar)'
    OR a.nombre_original ~* '\\.(zip|rar|7z|tar|gz)$' THEN 'comprimidos'
  WHEN a.tipo_mime ~* '(pdf|word|officedocument|opendocument|rtf)'
    OR a.nombre_original ~* '\\.(txt|csv|xls|xlsx|ppt|pptx|doc|docx)$' THEN 'documentos'
  ELSE 'otros'
END`;

// Lista blanca: nunca se interpola texto del usuario en el ORDER BY.
const ORDENES = {
  recientes: 'f.created_at DESC, f.id ASC',
  antiguos: 'f.created_at ASC, f.id ASC',
  nombre_asc: 'f.nombre_norm COLLATE "C" ASC, f.id ASC',
  tamanio_desc: 'f.tamanio_bytes DESC, f.id ASC',
  tamanio_asc: 'f.tamanio_bytes ASC, f.id ASC',
};

// Escapa % _ \ para que el texto del usuario se busque literalmente.
const patron = (q) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

async function listarArchivos({ q, tipo, etiquetaIds, autorId, orden, pagina }) {
  const params = [];
  const p = (valor) => { params.push(valor); return `$${params.length}`; };
  const filtros = ['a.es_publica = TRUE'];

  if (tipo) filtros.push(`(${TIPO_SQL}) = ${p(tipo)}`);
  if (autorId) filtros.push(`a.usuario_id = ${p(autorId)}::uuid`);
  if (etiquetaIds.length) {
    // OR entre etiquetas; EXISTS evita duplicar archivos.
    filtros.push(`EXISTS (SELECT 1 FROM archivo_etiquetas ae
      WHERE ae.archivo_id = a.id AND ae.etiqueta_id = ANY(${p(etiquetaIds)}::int[]))`);
  }
  if (q) {
    const n = p(patron(q));
    filtros.push(`(
      unaccent(a.nombre_original) ILIKE unaccent(${n}::text) ESCAPE '\\'
      OR unaccent(u.nombre_completo) ILIKE unaccent(${n}::text) ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM archivo_etiquetas ae JOIN etiquetas e ON e.id = ae.etiqueta_id
        WHERE ae.archivo_id = a.id AND unaccent(e.nombre) ILIKE unaccent(${n}::text) ESCAPE '\\')
    )`);
  }
  const offset = p((pagina - 1) * POR_PAGINA);

  // Una sola sentencia = una sola instantánea: total e items son coherentes.
  const sql = `
    WITH filtrados AS (
      SELECT a.id, a.nombre_original, a.tamanio_bytes, a.tipo_mime, a.created_at,
             a.usuario_id AS autor_id, u.nombre_completo AS autor_nombre,
             unaccent(lower(a.nombre_original)) AS nombre_norm
      FROM archivos a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE ${filtros.join('\n        AND ')}
    ),
    total AS (SELECT count(*)::int AS n FROM filtrados),
    pagina AS (
      SELECT f.*, ROW_NUMBER() OVER (ORDER BY ${ORDENES[orden]}) AS rn
      FROM filtrados f
      ORDER BY rn
      LIMIT ${POR_PAGINA} OFFSET ${offset}
    )
    SELECT t.n AS total, p.id, p.nombre_original, p.tamanio_bytes, p.tipo_mime,
           p.created_at, p.autor_id, p.autor_nombre,
           (SELECT COALESCE(json_agg(json_build_object('id', e.id, 'nombre', e.nombre)
                    ORDER BY unaccent(lower(e.nombre)), e.id), '[]'::json)
            FROM archivo_etiquetas ae JOIN etiquetas e ON e.id = ae.etiqueta_id
            WHERE ae.archivo_id = p.id) AS etiquetas
    FROM total t
    LEFT JOIN pagina p ON TRUE
    ORDER BY p.rn`;

  const { rows } = await pool.query(sql, params);
  const items = rows
    .filter((r) => r.id !== null)
    .map((r) => ({
      id: r.id,
      nombre_original: r.nombre_original,
      tamanio_bytes: String(r.tamanio_bytes), // BIGINT como string decimal
      tipo_mime: r.tipo_mime,
      created_at: r.created_at,
      autor: { id: r.autor_id, nombre_completo: r.autor_nombre },
      etiquetas: r.etiquetas,
    }));
  return { items, total: rows[0]?.total ?? 0, pagina, por_pagina: POR_PAGINA };
}

async function listarEtiquetas({ q, limite }) {
  const params = [];
  const filtros = [`EXISTS (SELECT 1 FROM archivo_etiquetas ae
      JOIN archivos a ON a.id = ae.archivo_id
      WHERE ae.etiqueta_id = e.id AND a.es_publica = TRUE)`];
  if (q) {
    params.push(patron(q));
    filtros.push(`unaccent(e.nombre) ILIKE unaccent($${params.length}::text) ESCAPE '\\'`);
  }
  params.push(limite);
  const { rows } = await pool.query(
    `SELECT e.id, e.nombre FROM etiquetas e
     WHERE ${filtros.join(' AND ')}
     ORDER BY unaccent(lower(e.nombre)) COLLATE "C", e.id
     LIMIT $${params.length}`,
    params,
  );
  return { items: rows };
}

async function listarAutores({ q, limite }) {
  const params = [];
  const filtros = [`EXISTS (SELECT 1 FROM archivos a
      WHERE a.usuario_id = u.id AND a.es_publica = TRUE)`];
  if (q) {
    params.push(patron(q));
    filtros.push(`unaccent(u.nombre_completo) ILIKE unaccent($${params.length}::text) ESCAPE '\\'`);
  }
  params.push(limite);
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre_completo FROM usuarios u
     WHERE ${filtros.join(' AND ')}
     ORDER BY unaccent(lower(u.nombre_completo)) COLLATE "C", u.id
     LIMIT $${params.length}`,
    params,
  );
  return { items: rows };
}

module.exports = { POR_PAGINA, listarArchivos, listarEtiquetas, listarAutores };