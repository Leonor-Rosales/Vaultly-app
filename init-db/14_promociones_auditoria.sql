BEGIN;
SELECT pg_advisory_xact_lock(7102026);
ALTER TABLE planes ADD COLUMN promocion_precio NUMERIC(10,2), ADD COLUMN promocion_inicio TIMESTAMPTZ, ADD COLUMN promocion_fin TIMESTAMPTZ;
ALTER TABLE planes ADD CONSTRAINT planes_promocion_valida CHECK (
  (promocion_precio IS NULL AND promocion_inicio IS NULL AND promocion_fin IS NULL) OR
  (promocion_precio IS NOT NULL AND promocion_inicio IS NOT NULL AND promocion_fin IS NOT NULL
   AND nombre <> 'Free' AND promocion_precio >= 0 AND promocion_precio < precio_mensual AND promocion_inicio < promocion_fin)
);
CREATE OR REPLACE FUNCTION versionar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.nombre,NEW.precio_mensual,NEW.cuota_storage_gb,NEW.limite_descargas,NEW.permite_carpetas_publicas,NEW.activo,NEW.promocion_precio,NEW.promocion_inicio,NEW.promocion_fin)
    IS DISTINCT FROM ROW(OLD.nombre,OLD.precio_mensual,OLD.cuota_storage_gb,OLD.limite_descargas,OLD.permite_carpetas_publicas,OLD.activo,OLD.promocion_precio,OLD.promocion_inicio,OLD.promocion_fin) THEN
    NEW.version := OLD.version + 1;
  ELSE NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;
INSERT INTO tipos_accion(codigo,descripcion) VALUES
 ('ADMIN_CREADO','Alta de administrador'), ('ADMIN_EDITADO','Edición de administrador'),
 ('ADMIN_ACTIVADO','Activación de administrador'), ('ADMIN_DESACTIVADO','Desactivación de administrador')
ON CONFLICT(codigo) DO NOTHING;
CREATE INDEX auditoria_modulo_fecha ON auditoria(modulo_afectado,fecha_hora DESC,id DESC);
INSERT INTO migraciones_vaultly(nombre) VALUES ('14_promociones_auditoria');
COMMIT;
