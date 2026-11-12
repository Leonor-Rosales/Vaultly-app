BEGIN;
SELECT pg_advisory_xact_lock(7102026);
CREATE TABLE correos_retiro_planes (
 id BIGSERIAL PRIMARY KEY,
 plan_id INT NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
 version_plan INT NOT NULL,
 usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 suscripcion_id UUID NOT NULL REFERENCES suscripciones(id) ON DELETE CASCADE,
 retirado_en TIMESTAMPTZ NOT NULL,
 estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','CANCELADO')),
 intentos INT NOT NULL DEFAULT 0 CHECK (intentos >= 0),
 proximo_intento TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 enviado_en TIMESTAMPTZ,
 UNIQUE(plan_id, version_plan, usuario_id)
);
CREATE INDEX correos_retiro_pendientes ON correos_retiro_planes(proximo_intento,id) WHERE estado='PENDIENTE';
INSERT INTO migraciones_vaultly(nombre) VALUES ('17_correos_retiro_planes');
COMMIT;
