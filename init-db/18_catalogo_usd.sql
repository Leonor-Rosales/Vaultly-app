BEGIN;
SELECT pg_advisory_xact_lock(7102026);
-- Los planes ajenos a este catálogo conservan sus precios y su moneda original.
ALTER TABLE planes ADD COLUMN moneda TEXT NOT NULL DEFAULT 'GTQ' CHECK (moneda IN ('GTQ','USD'));
ALTER TABLE planes ALTER COLUMN moneda SET DEFAULT 'USD';
CREATE OR REPLACE FUNCTION versionar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.promocion_tipo='PORCENTAJE' THEN NEW.promocion_precio := round(NEW.precio_mensual*(100-NEW.promocion_porcentaje)/100,2);
  ELSIF NEW.promocion_tipo='GRATIS' THEN NEW.promocion_precio := 0;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.moneda,NEW.nombre,NEW.precio_mensual,NEW.cuota_storage_gb,NEW.limite_descargas,NEW.permite_carpetas_publicas,NEW.activo,NEW.promocion_precio,NEW.promocion_inicio,NEW.promocion_fin,NEW.promocion_tipo,NEW.promocion_porcentaje,NEW.inactivo_desde,NEW.archivado_en)
      IS DISTINCT FROM ROW(OLD.moneda,OLD.nombre,OLD.precio_mensual,OLD.cuota_storage_gb,OLD.limite_descargas,OLD.permite_carpetas_publicas,OLD.activo,OLD.promocion_precio,OLD.promocion_inicio,OLD.promocion_fin,OLD.promocion_tipo,OLD.promocion_porcentaje,OLD.inactivo_desde,OLD.archivado_en) THEN NEW.version := OLD.version + 1;
    ELSE NEW.version := OLD.version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- Sustitución autorizada del catálogo de prueba, incluidas suscripciones existentes.
-- Referencia Banguat 12/11/2026: Q7.64878/USD; ceil((quetzales/7.64878)*10)/10.
-- Se retiran promociones anteriores para no aplicar descuentos sobre precios distintos.
UPDATE planes p SET cuota_storage_gb=c.gb, limite_descargas=c.descargas,
 precio_mensual=c.precio, moneda='USD',
 promocion_precio=NULL, promocion_inicio=NULL, promocion_fin=NULL,
 promocion_tipo=NULL, promocion_porcentaje=NULL
FROM (VALUES ('Free',5,5,0.00), ('Basic Open',15,50,1.20),
 ('Pro Developer',50,200,2.50), ('Max Vault',100,500,3.80)) AS c(nombre,gb,descargas,precio)
WHERE p.nombre=c.nombre;
-- No se modifican pagos, comprobantes, usuarios ni contadores de consumo.
INSERT INTO migraciones_vaultly(nombre) VALUES ('18_catalogo_usd');
COMMIT;
