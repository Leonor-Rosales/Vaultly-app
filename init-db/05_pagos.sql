-- Pagos simulados: historial de contrataciones de plan.
-- Nunca se guardan datos de tarjeta ni de cuenta bancaria; solo el resultado del cobro simulado.
BEGIN;
SELECT pg_advisory_xact_lock(7102026);
CREATE TABLE IF NOT EXISTS migraciones_vaultly (
  nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plan_id INT NOT NULL REFERENCES planes(id),
  plan_nombre TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
  metodo TEXT NOT NULL CHECK (metodo IN ('TARJETA', 'TRANSFERENCIA')),
  estado TEXT NOT NULL DEFAULT 'COMPLETADO' CHECK (estado IN ('COMPLETADO', 'PENDIENTE')),
  codigo TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagos_usuario ON pagos(usuario_id, creado_en DESC);
INSERT INTO migraciones_vaultly(nombre) VALUES ('05_pagos') ON CONFLICT DO NOTHING;
COMMIT;
