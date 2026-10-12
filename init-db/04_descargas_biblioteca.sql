BEGIN;
SELECT pg_advisory_xact_lock(7102026);
-- La versión 03 solo permitía descargar archivos propios. Esos cargos no
-- pertenecen a la biblioteca: se devuelven una única vez al adoptar esta regla.
-- Aplicar con el backend detenido, antes de servir descargas públicas autenticadas.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM migraciones_vaultly WHERE nombre='04_descargas_biblioteca') THEN
    DELETE FROM reservas_descarga;
    UPDATE ciclos_descargas SET consumidas=0;
    UPDATE suscripciones SET descargas_consumidas_ciclo=0;
    INSERT INTO migraciones_vaultly(nombre) VALUES ('04_descargas_biblioteca');
  END IF;
END $$;
COMMIT;
