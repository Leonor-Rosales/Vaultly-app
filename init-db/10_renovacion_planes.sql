BEGIN;
SELECT pg_advisory_xact_lock(7102026);

ALTER TABLE suscripciones
  ADD COLUMN IF NOT EXISTS renovacion_automatica BOOLEAN NOT NULL DEFAULT false;

INSERT INTO migraciones_vaultly(nombre) VALUES ('10_renovacion_planes') ON CONFLICT DO NOTHING;
COMMIT;
