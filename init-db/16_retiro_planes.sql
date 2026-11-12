BEGIN;
SELECT pg_advisory_xact_lock(7102026);
ALTER TABLE planes ADD COLUMN inactivo_desde TIMESTAMPTZ, ADD COLUMN archivado_en TIMESTAMPTZ;
-- No conocemos cuánto tiempo llevan inactivos los planes anteriores: el plazo empieza ahora.
UPDATE planes SET inactivo_desde=statement_timestamp() WHERE NOT activo;
ALTER TABLE planes ADD CONSTRAINT planes_retiro_valido CHECK (
 ((activo AND inactivo_desde IS NULL) OR (NOT activo AND inactivo_desde IS NOT NULL))
 AND (archivado_en IS NULL OR NOT activo)
 AND (nombre <> 'Free' OR (activo AND archivado_en IS NULL))
);
CREATE FUNCTION registrar_inactividad_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activo THEN NEW.inactivo_desde := NULL; NEW.archivado_en := NULL;
  ELSIF TG_OP='INSERT' THEN NEW.inactivo_desde := clock_timestamp();
  ELSIF OLD.activo THEN NEW.inactivo_desde := clock_timestamp(); NEW.archivado_en := NULL;
  ELSE NEW.inactivo_desde := COALESCE(NEW.inactivo_desde,OLD.inactivo_desde,clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER planes_retiro BEFORE INSERT OR UPDATE ON planes FOR EACH ROW EXECUTE FUNCTION registrar_inactividad_plan();
CREATE OR REPLACE FUNCTION versionar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.promocion_tipo='PORCENTAJE' THEN NEW.promocion_precio := round(NEW.precio_mensual*(100-NEW.promocion_porcentaje)/100,2);
  ELSIF NEW.promocion_tipo='GRATIS' THEN NEW.promocion_precio := 0;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.nombre,NEW.precio_mensual,NEW.cuota_storage_gb,NEW.limite_descargas,NEW.permite_carpetas_publicas,NEW.activo,NEW.promocion_precio,NEW.promocion_inicio,NEW.promocion_fin,NEW.promocion_tipo,NEW.promocion_porcentaje,NEW.inactivo_desde,NEW.archivado_en)
      IS DISTINCT FROM ROW(OLD.nombre,OLD.precio_mensual,OLD.cuota_storage_gb,OLD.limite_descargas,OLD.permite_carpetas_publicas,OLD.activo,OLD.promocion_precio,OLD.promocion_inicio,OLD.promocion_fin,OLD.promocion_tipo,OLD.promocion_porcentaje,OLD.inactivo_desde,OLD.archivado_en) THEN NEW.version := OLD.version + 1;
    ELSE NEW.version := OLD.version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE INDEX planes_inactivos_retiro ON planes(inactivo_desde,id) WHERE NOT activo AND archivado_en IS NULL AND nombre <> 'Free';
CREATE INDEX suscripciones_plan_retiro ON suscripciones(plan_id,estado,fecha_fin);
CREATE INDEX pagos_plan_retiro ON pagos(plan_id);
INSERT INTO tipos_accion(codigo,descripcion) VALUES ('PLAN_ARCHIVADO','Retiro automático del listado conservando historial'),('PLAN_ELIMINADO','Borrado automático de un plan sin uso') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO migraciones_vaultly(nombre) VALUES ('16_retiro_planes');
COMMIT;
