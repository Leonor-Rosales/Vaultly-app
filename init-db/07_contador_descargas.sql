BEGIN;
SELECT pg_advisory_xact_lock(7102026);

ALTER TABLE archivos
ADD COLUMN IF NOT EXISTS descargas BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'archivos_descargas_no_negativas'
          AND conrelid = 'archivos'::regclass
    ) THEN
        ALTER TABLE archivos
        ADD CONSTRAINT archivos_descargas_no_negativas
        CHECK (descargas >= 0);
    END IF;
END $$;

INSERT INTO migraciones_vaultly(nombre) VALUES ('07_contador_descargas') ON CONFLICT DO NOTHING;
COMMIT;
