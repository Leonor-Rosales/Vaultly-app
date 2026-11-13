# Catálogo de prueba en dólares

La migración `18_catalogo_usd.sql` reemplaza los cuatro planes actuales, incluidas
las cuotas de suscripciones ya contratadas. Esta sustitución se autorizó porque
son datos de prueba; no introduce versiones históricas de los beneficios.

| Plan | Almacenamiento | Descargas públicas/mes | Precio mensual USD |
| --- | --- | --- | --- |
| Free | 5 GB | 5 | 0.00 |
| Basic Open | 15 GB | 50 | 1.20 |
| Pro Developer | 50 GB | 200 | 2.50 |
| Max Vault | 100 GB | 500 | 3.80 |

Conversión de Q0, Q9, Q19 y Q29 con referencia de
[Banguat](https://www.banguat.gob.gt/tipo_cambio/) del 12/11/2026:
Q7.64878 por USD. Redondeo hacia arriba a una décima:
`ceil((quetzales / 7.64878) * 10) / 10`. Los precios resultantes son fijos;
no se recalculan con la cotización diaria.

Se quitan promociones previas de esos cuatro planes y se incrementa su versión
para rechazar formularios de compra abiertos con condiciones antiguas.
Se conservan IDs, usuarios, archivos, estados de los planes, pagos,
comprobantes y contadores de consumo. Otros planes existentes conservan su
moneda GTQ; los nuevos planes administrativos se crean en USD.
La aplicación muestra la moneda del plan y conserva GTQ en pagos históricos,
incluidos los que no tenían comprobante. Compras y renovaciones nuevas guardan
la moneda del plan en el comprobante. La migración se registra una sola vez:
actualizaciones posteriores no sobrescriben cambios administrativos.

## Aplicar en Oracle

En la sesión SSH, primero descargar y construir. Si falla algún comando,
resolverlo antes de continuar al siguiente bloque.

```bash
cd ~/Vaultly-app
git pull --ff-only origin feature/adaptaciones
sudo docker compose --env-file .env.production -f compose.production.yml build backend web vistas-previas
```

Detener escrituras de la aplicación y respaldar PostgreSQL. Verificar que el
archivo mostrado existe y tiene contenido antes de ejecutar la migración.

```bash
sudo docker compose --env-file .env.production -f compose.production.yml stop backend vistas-previas
umask 077
mkdir -p backups
respaldo="backups/antes-catalogo-usd-$(date +%Y%m%d-%H%M%S).sql"
sudo docker compose --env-file .env.production -f compose.production.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$respaldo"
ls -lh "$respaldo"
```

Aplicar; continuar solo si finaliza sin errores.

```bash
sudo docker compose --env-file .env.production -f compose.production.yml run --rm --no-deps migrar
```

Iniciar los servicios actualizados y verificar.

```bash
sudo docker compose --env-file .env.production -f compose.production.yml up -d --no-deps backend vistas-previas web
sudo docker compose --env-file .env.production -f compose.production.yml ps -a
curl -fsS https://vaultly.160.34.218.207.sslip.io/api/health
```

Esperar a que backend esté healthy. Recargar la web y revisar los cuatro planes
y un comprobante nuevo. No usar `down -v`: elimina los volúmenes de datos.

## Validación local

`npm --prefix backend run test:catalogo-usd`, con
`TEST_MIGRATIONS_DATABASE_URL` apuntando a PostgreSQL local exclusivo
`vaultly_migraciones_test`, comprueba sustitución, compras y renovaciones USD,
conservación de pagos GTQ y contadores, control de versiones y repetición.
