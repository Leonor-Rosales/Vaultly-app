BEGIN;
SELECT pg_advisory_xact_lock(7102026);
ALTER TABLE planes ADD COLUMN promocion_tipo TEXT, ADD COLUMN promocion_porcentaje NUMERIC(5,2);
UPDATE planes SET promocion_tipo=CASE WHEN promocion_precio=0 THEN 'GRATIS' ELSE 'FIJO' END WHERE promocion_precio IS NOT NULL;
ALTER TABLE planes ADD CONSTRAINT planes_tipo_promocion_valido CHECK (
 (promocion_tipo IS NULL AND promocion_porcentaje IS NULL AND promocion_precio IS NULL) OR
 (promocion_tipo IS NOT NULL AND promocion_precio IS NOT NULL AND (
   (promocion_tipo='FIJO' AND promocion_porcentaje IS NULL) OR
   (promocion_tipo='GRATIS' AND promocion_porcentaje IS NULL AND promocion_precio=0) OR
   (promocion_tipo='PORCENTAJE' AND promocion_porcentaje IS NOT NULL AND promocion_porcentaje>0 AND promocion_porcentaje<=100
    AND promocion_precio=round(precio_mensual*(100-promocion_porcentaje)/100,2))
 ))
);
CREATE OR REPLACE FUNCTION versionar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.promocion_tipo='PORCENTAJE' THEN NEW.promocion_precio := round(NEW.precio_mensual*(100-NEW.promocion_porcentaje)/100,2);
  ELSIF NEW.promocion_tipo='GRATIS' THEN NEW.promocion_precio := 0;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.nombre,NEW.precio_mensual,NEW.cuota_storage_gb,NEW.limite_descargas,NEW.permite_carpetas_publicas,NEW.activo,NEW.promocion_precio,NEW.promocion_inicio,NEW.promocion_fin,NEW.promocion_tipo,NEW.promocion_porcentaje)
      IS DISTINCT FROM ROW(OLD.nombre,OLD.precio_mensual,OLD.cuota_storage_gb,OLD.limite_descargas,OLD.permite_carpetas_publicas,OLD.activo,OLD.promocion_precio,OLD.promocion_inicio,OLD.promocion_fin,OLD.promocion_tipo,OLD.promocion_porcentaje) THEN NEW.version := OLD.version + 1;
    ELSE NEW.version := OLD.version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER planes_version ON planes;
CREATE TRIGGER planes_version BEFORE INSERT OR UPDATE ON planes FOR EACH ROW EXECUTE FUNCTION versionar_plan();
INSERT INTO migraciones_vaultly(nombre) VALUES ('15_tipos_promociones');
COMMIT;
