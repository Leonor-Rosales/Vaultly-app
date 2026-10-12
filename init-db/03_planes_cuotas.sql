BEGIN;
SELECT pg_advisory_xact_lock(7102026);
CREATE TABLE IF NOT EXISTS migraciones_vaultly (
  nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ciclos_descargas (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL CHECK (fin > inicio),
  consumidas BIGINT NOT NULL DEFAULT 0 CHECK (consumidas >= 0),
  PRIMARY KEY (usuario_id, inicio)
);
CREATE TABLE IF NOT EXISTS reservas_subida (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_objeto TEXT NOT NULL UNIQUE,
  bytes BIGINT NOT NULL CHECK (bytes >= 0),
  vence_en TIMESTAMPTZ NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservas_subida_usuario ON reservas_subida(usuario_id);
CREATE TABLE IF NOT EXISTS reservas_descarga (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL,
  ciclo_inicio TIMESTAMPTZ NOT NULL,
  estado TEXT NOT NULL DEFAULT 'RESERVADA' CHECK (estado IN ('RESERVADA', 'CONSUMIDA')),
  vence_en TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (usuario_id, ciclo_inicio) REFERENCES ciclos_descargas(usuario_id, inicio) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reservas_descarga_usuario ON reservas_descarga(usuario_id);

-- Conserva el contador anterior una sola vez, sin regalar descargas al migrar.
INSERT INTO ciclos_descargas(usuario_id, inicio, fin, consumidas)
SELECT usuario_id,
       date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
       (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC',
       descargas_consumidas_ciclo
FROM suscripciones WHERE estado = 'ACTIVA'
  AND fecha_inicio <= CURRENT_TIMESTAMP AND fecha_fin > CURRENT_TIMESTAMP
  AND NOT EXISTS (SELECT 1 FROM migraciones_vaultly WHERE nombre = '03_planes_cuotas')
ON CONFLICT (usuario_id, inicio) DO NOTHING;

-- Invariante de persistencia: cuenta y suscripción Free nacen en la misma transacción.
CREATE OR REPLACE FUNCTION asignar_free_nuevo_usuario() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE free_id INT;
BEGIN
  SELECT id INTO free_id FROM planes WHERE nombre = 'Free' AND activo = TRUE;
  IF free_id IS NULL THEN RAISE EXCEPTION 'Falta el plan Free activo'; END IF;
  INSERT INTO suscripciones(usuario_id, plan_id, fecha_inicio, fecha_fin, estado)
  VALUES (NEW.id, free_id, CURRENT_TIMESTAMP,
    (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC', 'ACTIVA');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_usuario_plan_free ON usuarios;
CREATE TRIGGER trg_usuario_plan_free AFTER INSERT ON usuarios
FOR EACH ROW EXECUTE FUNCTION asignar_free_nuevo_usuario();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Free' AND activo) THEN
    RAISE EXCEPTION 'Falta el plan Free activo: revisar catálogo antes de migrar';
  END IF;
END $$;
INSERT INTO suscripciones(usuario_id, plan_id, fecha_inicio, fecha_fin, estado)
SELECT u.id, p.id, CURRENT_TIMESTAMP,
       (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC', 'ACTIVA'
FROM usuarios u CROSS JOIN planes p
WHERE p.nombre = 'Free' AND p.activo
  AND NOT EXISTS (SELECT 1 FROM suscripciones s WHERE s.usuario_id=u.id AND s.estado='ACTIVA')
ON CONFLICT (usuario_id) WHERE estado = 'ACTIVA' DO NOTHING;
INSERT INTO migraciones_vaultly(nombre) VALUES ('03_planes_cuotas') ON CONFLICT DO NOTHING;
COMMIT;
