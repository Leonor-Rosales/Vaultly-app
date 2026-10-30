BEGIN;
SELECT pg_advisory_xact_lock(7102026);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo_actualizado_en TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS cambios_correo (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  solicitud_id UUID,
  correo_anterior VARCHAR(150),
  correo_nuevo VARCHAR(150),
  codigo_hash VARCHAR(255),
  estado VARCHAR(20) NOT NULL DEFAULT 'CANCELADO'
    CHECK (estado IN ('ENVIANDO','PENDIENTE','FALLIDO','CANCELADO','CONSUMIDO','BLOQUEADO')),
  vence_en TIMESTAMPTZ,
  reenviar_desde TIMESTAMPTZ,
  intentos INT NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
  ventana_envios TIMESTAMPTZ,
  envios INT NOT NULL DEFAULT 0 CHECK (envios >= 0),
  ventana_password TIMESTAMPTZ,
  fallos_password INT NOT NULL DEFAULT 0 CHECK (fallos_password >= 0)
);

INSERT INTO migraciones_vaultly(nombre) VALUES ('08_cambio_correo') ON CONFLICT DO NOTHING;
COMMIT;
