BEGIN;
SELECT pg_advisory_xact_lock(7102026);
ALTER TABLE planes ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
-- También protege ante actualizaciones del catálogo realizadas fuera de la API.
CREATE FUNCTION versionar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.nombre,NEW.precio_mensual,NEW.cuota_storage_gb,NEW.limite_descargas,NEW.permite_carpetas_publicas,NEW.activo)
    IS DISTINCT FROM ROW(OLD.nombre,OLD.precio_mensual,OLD.cuota_storage_gb,OLD.limite_descargas,OLD.permite_carpetas_publicas,OLD.activo) THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER planes_version BEFORE UPDATE ON planes FOR EACH ROW EXECUTE FUNCTION versionar_plan();
INSERT INTO tipos_accion(codigo,descripcion) VALUES
  ('PLAN_CREADO','Creación de plan'), ('PLAN_EDITADO','Edición de condiciones del plan'),
  ('PLAN_ACTIVADO','Activación de plan'), ('PLAN_DESACTIVADO','Retiro de plan del catálogo')
ON CONFLICT(codigo) DO NOTHING;
INSERT INTO migraciones_vaultly(nombre) VALUES ('13_seguridad_planes');
COMMIT;
