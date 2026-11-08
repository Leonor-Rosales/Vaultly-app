BEGIN;
SELECT pg_advisory_xact_lock(7102026);
CREATE TABLE papelera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL REFERENCES usuarios(id),
  elemento_id uuid NOT NULL, tipo text NOT NULL CHECK(tipo IN ('archivo','carpeta')),
  nombre text NOT NULL, padre_original uuid, ubicacion text NOT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(), vence_en timestamptz NOT NULL DEFAULT (now() + interval '720 hours')
);
CREATE INDEX papelera_usuario ON papelera(usuario_id, enviado_en DESC);
CREATE INDEX papelera_vencimiento ON papelera(vence_en);
ALTER TABLE archivos ADD COLUMN papelera_id uuid REFERENCES papelera(id);
ALTER TABLE carpetas ADD COLUMN papelera_id uuid REFERENCES papelera(id);
CREATE INDEX archivos_papelera ON archivos(papelera_id) WHERE papelera_id IS NOT NULL;
CREATE INDEX carpetas_papelera ON carpetas(papelera_id) WHERE papelera_id IS NOT NULL;
DROP INDEX uq_carpetas_nombre_ubicacion;
CREATE UNIQUE INDEX uq_carpetas_nombre_ubicacion ON carpetas(usuario_id, carpeta_padre_id, lower(btrim(nombre))) NULLS NOT DISTINCT WHERE papelera_id IS NULL;
CREATE VIEW archivos_activos AS SELECT * FROM archivos WHERE papelera_id IS NULL WITH LOCAL CHECK OPTION;
CREATE VIEW carpetas_activas AS SELECT * FROM carpetas WHERE papelera_id IS NULL WITH LOCAL CHECK OPTION;
CREATE TABLE objetos_pendientes_borrado (objeto text PRIMARY KEY, reintentar_en timestamptz NOT NULL DEFAULT now());
-- Una subida o movimiento concurrente solo puede terminar en una carpeta activa.
CREATE FUNCTION validar_destino_activo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE padre uuid;
BEGIN
  padre := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF padre IS NOT NULL AND NEW.papelera_id IS NULL THEN
    PERFORM id FROM carpetas WHERE id=padre AND usuario_id=NEW.usuario_id AND papelera_id IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='23503'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER destino_archivo_activo BEFORE INSERT OR UPDATE OF carpeta_id ON archivos FOR EACH ROW EXECUTE FUNCTION validar_destino_activo('carpeta_id');
CREATE TRIGGER destino_carpeta_activa BEFORE INSERT OR UPDATE OF carpeta_padre_id ON carpetas FOR EACH ROW EXECUTE FUNCTION validar_destino_activo('carpeta_padre_id');
INSERT INTO migraciones_vaultly(nombre) VALUES ('11_papelera');
COMMIT;
