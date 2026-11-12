-- Los pagos anteriores conservan NULL: no es posible reconstruir sus datos históricos.
BEGIN;
SELECT pg_advisory_xact_lock(7102026);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante JSONB;
ALTER TABLE pagos ADD CONSTRAINT pagos_comprobante_objeto CHECK (comprobante IS NULL OR jsonb_typeof(comprobante) = 'object');
INSERT INTO migraciones_vaultly(nombre) VALUES ('12_comprobantes_pago') ON CONFLICT DO NOTHING;
COMMIT;
