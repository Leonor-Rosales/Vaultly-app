BEGIN;
SELECT pg_advisory_xact_lock(7102026);

CREATE TABLE IF NOT EXISTS vistas_previas (
    id UUID PRIMARY KEY,
    archivo_id UUID UNIQUE REFERENCES archivos(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'LISTA', 'FALLIDA')),
    intentos INTEGER NOT NULL DEFAULT 0,
    disponible_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vistas_previas_pendientes
    ON vistas_previas(disponible_en) WHERE estado IN ('PENDIENTE', 'PROCESANDO') OR archivo_id IS NULL;

CREATE OR REPLACE FUNCTION encolar_vista_previa() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tipo_mime IN (
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) OR (
        NEW.tipo_mime IN ('', 'application/octet-stream', 'application/zip')
        AND lower(NEW.nombre_original) ~ '\.(docx|xlsx)$'
    ) THEN
        INSERT INTO vistas_previas(id, archivo_id) VALUES (NEW.id, NEW.id) ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS archivo_vista_previa ON archivos;
CREATE TRIGGER archivo_vista_previa AFTER INSERT OR UPDATE OF nombre_original, tipo_mime ON archivos
    FOR EACH ROW EXECUTE FUNCTION encolar_vista_previa();

-- Incluye documentos que ya estaban guardados antes de instalar el conversor.
INSERT INTO vistas_previas(id, archivo_id)
SELECT id, id FROM archivos
WHERE tipo_mime IN (
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
) OR (tipo_mime IN ('', 'application/octet-stream', 'application/zip') AND lower(nombre_original) ~ '\.(docx|xlsx)$')
ON CONFLICT DO NOTHING;

INSERT INTO migraciones_vaultly(nombre) VALUES ('09_vistas_previas') ON CONFLICT DO NOTHING;
COMMIT;
