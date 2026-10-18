-- Biblioteca pública: búsqueda sin acentos e índices de apoyo.
BEGIN;
SELECT pg_advisory_xact_lock(7102026);
CREATE TABLE IF NOT EXISTS migraciones_vaultly (
  nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
-- Necesaria para buscar sin distinguir acentos (unaccent).
CREATE EXTENSION IF NOT EXISTS unaccent;
 
-- La PK de archivo_etiquetas es (archivo_id, etiqueta_id): este índice cubre
-- el filtro por etiqueta_id y las opciones de etiquetas.
CREATE INDEX IF NOT EXISTS idx_archivo_etiquetas_etiqueta
    ON archivo_etiquetas (etiqueta_id, archivo_id);
 
-- Orden por defecto de la biblioteca (solo archivos públicos).
CREATE INDEX IF NOT EXISTS idx_archivos_publicos_recientes
    ON archivos (created_at DESC, id)
    WHERE es_publica = TRUE;
 
INSERT INTO migraciones_vaultly(nombre) VALUES ('06_biblioteca') ON CONFLICT DO NOTHING;
COMMIT;