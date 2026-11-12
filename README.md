# Vaultly-app
Plataforma de almacenamiento en la nube

La propuesta de comprobantes con datos históricos requiere `12_comprobantes_pago.sql`.
Consulta [Comprobantes de pago](docs/comprobantes-pago.md) para la actualización y pruebas.

La protección frente a cambios concurrentes del catálogo requiere `13_seguridad_planes.sql`.
Consulta [Seguridad de planes](docs/seguridad-planes.md) para los contratos de versión y auditoría.

Las promociones temporales a Q0 y la pantalla de auditoría requieren
`14_promociones_auditoria.sql`; consulta [Promociones y auditoría](docs/promociones-auditoria.md).
El selector de porcentaje, precio fijo o período gratis requiere `15_tipos_promociones.sql`.

La administración de planes y usuarios está documentada en [Administración](docs/administracion.md),
incluidas las reglas de suscripciones existentes y las pruebas del panel.

Para la configuración, los temas y el cambio de correo verificado, consulta
[Configuración y seguridad](docs/admin-configuracion-seguridad.md). Esta versión
requiere aplicar `08_cambio_correo.sql` mediante el migrador antes de iniciar el backend.

La configuración compartida del cliente y administrador, sus endpoints y pasos de prueba
están en [Configuración del cliente](docs/cliente-configuracion.md).

## Entorno local
Esta configuración inicia PostgreSQL y MinIO

## Requisitos
- Git
- Docker Desktop instalado y en ejecución
- Docker Compose

## Instalación inicial en Windows
Comandos:
git clone https://github.com/Leonor-Rosales/Vaultly-app.git
cd Vaultly-app
git switch develop
Copy-Item .env.example .env

Editar .env y reemplazar los marcadores de contraseña
de PostgreSQL y MinIO por valores locales.

No subir .env al repositorio.

Validar e iniciar los servicios:

docker compose config --quiet
npm --prefix backend run migrate:check
docker compose pull
docker compose up -d
docker compose ps

## Inicialización de la base de datos
En el primer arranque, con el directorio de datos vacío,
PostgreSQL ejecuta estos archivos en orden:

1. init-db/01_schema.sql
2. init-db/02_seeds.sql
3. init-db/03_planes_cuotas.sql
4. init-db/04_descargas_biblioteca.sql
5. init-db/05_pagos.sql
6. init-db/06_biblioteca.sql
7. init-db/07_contador_descargas.sql
8. init-db/08_cambio_correo.sql

La ruta es `init-db` (con guion). `00_validar_migraciones.sh` rechaza prefijos SQL
duplicados antes de inicializar Docker. El migrador de Node aplica la misma validación.
Los scripts de inicialización de Docker no se ejecutan nuevamente al reiniciar un volumen existente.

Para una base existente, con el backend detenido y su conexión local ya configurada:

```powershell
npm --prefix backend run migrate:check
npm --prefix backend run migrate
```

Configura previamente `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`
en `backend/.env` o en el entorno. `npm --prefix backend` ejecuta el script desde
`backend`; no utiliza las variables `POSTGRES_*` del `.env` de Compose directamente.
Después de migrar, reinicia el backend con `npm --prefix backend start` y reconstruye
el frontend con `npm --prefix frontend run build`.

El migrador también admite una base vacía. En una existente omite `01_schema.sql`,
conserva los valores existentes del catálogo y consulta `migraciones_vaultly.nombre`
antes de ejecutar los SQL 03–07. Mantiene las claves históricas completas (no solo
su número), incluidas las de 03 y 04 para no repetir la conversión de cuotas.
La migración histórica 04 solo restablece los cargos antiguos cuando aún no está
registrada; no se modifica esa regla de negocio. La normalización de etiquetas
se ejecuta en su propia transacción idempotente.

Se retiró `06_reservas_subida.sql` porque estaba completamente vacío; las tablas de
reservas ya las crea 03. Ejecutar anteriormente ese archivo, 06_biblioteca o ambos
no requiere renombrar ni borrar registros del historial. `06_biblioteca` y
`07_contador_descargas` conservan sus nombres. Si 07 se aplicó manualmente sin
registrarse, se adopta de forma idempotente conservando los contadores existentes.
La columna es `BIGINT NOT NULL DEFAULT 0`, con restricción `descargas >= 0`.

No borres volúmenes ni tablas para actualizar. Una segunda ejecución conserva datos
e historial. El usuario de PostgreSQL debe poder crear la extensión `unaccent`.
Si hay etiquetas inválidas, el migrador informa el error y revierte su transacción;
corrige esos datos antes de reintentar.

### Pruebas de regresión

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix backend test
# Navegador real; por defecto instala Chromium una vez:
cd frontend
npx playwright install chromium
npm run test:e2e
cd ..
# Alternativa con Microsoft Edge ya instalado: $env:PLAYWRIGHT_CHANNEL='msedge'
```

Las pruebas del navegador simulan únicamente las respuestas HTTP y verifican salida
por clic/teclado, almacenamiento, otra pestaña, Atrás, recarga y rutas privadas.
Para probar migraciones, usa exclusivamente una base local temporal llamada
`vaultly_migraciones_test` en un servidor separado de tu instalación:

```powershell
$env:TEST_MIGRATIONS_DATABASE_URL='postgresql://postgres:CLAVE_DE_PRUEBA@127.0.0.1:57079/vaultly_migraciones_test'
npm --prefix backend run test:migrations
```

Esta suite crea esquemas únicos y los conserva para inspección. Comprueba instalación
nueva, variantes de las antiguas migraciones 06, adopción de 07 sin historial,
repetición, preservación de datos y consultas reales de Biblioteca.

Consulta [planes, cuotas y descargas](docs/planes-cuotas-descargas.md) para las reglas,
endpoints, pruebas y pasos de ejecución local.

## Conexión desde DataGrip, pgAdmin o DBeaver
Host: localhost
Puerto: 5433
Base de datos: vaultly_db
Usuario: vaultly_admin
Contraseña: POSTGRES_PASSWORD de su archivo .env

## MinIO
- API S3: http://localhost:9000
- Consola web: http://localhost:9001
- Usuario: MINIO_ROOT_USER de .env
- Contraseña: MINIO_ROOT_PASSWORD de .env
- Bucket acordado: vaultly-files.

El servicio minio-init crea automáticamente el bucket vaultly-files si no existe y lo configura como privado
El backend Storage utiliza este bucket para subir, descargar y eliminar archivos, y controla los permisos de acceso
La imagen fijada de MinIO se utiliza para desarrollo local.
La configuración de producción se revisará por separado.

## Conexiones del backend
Ubicación del backend:
PostgreSQL 
API MinIO
Ejecutado en Windows:
localhost:5433
localhost:9000
En la misma red de Compose:
postgres:5432
minio:9000 |

Estos valores corresponden a los puertos de la configuración inicial
Si se cambian en .env, deben ajustarse las conexiones correspondientes

## Acuerdos de base de datos
- Los identificadores de usuarios, suscripciones, pagos, carpetas
  y archivos utilizan UUID.
- Los precios y montos se expresan en quetzales.
- limite_descargas = NULL significa descargas ilimitadas.
- Solo puede existir una suscripción marcada ACTIVA por usuario.
- El backend debe comprobar las fechas de vigencia y actualizar
  el estado de la suscripción al vencer, renovar o cambiar de plan.
- El backend debe impedir ciclos al mover carpetas.
- Eliminar archivos requiere coordinar PostgreSQL y MinIO.
- Las carpetas con contenido no se eliminan directamente por SQL.
- Las contraseñas de los usuarios se guardan como hashes
  generados por el backend.

## Vistas previas de Word y Excel

El módulo de archivos encola la conversión de DOCX y XLSX en PostgreSQL al guardar el original.
El proceso de trabajo del mismo backend convierte con LibreOffice y genera una miniatura con Poppler.
MinIO conserva los derivados privados. Las cuotas de usuario contabilizan el original.
Los documentos existentes se encolan en la migración 09.

Para instalar o actualizar el conversor local:

```powershell
docker compose up -d --build vistas-previas
```

El servicio aplica las migraciones al arrancar. La API y el frontend se ejecutan con sus comandos habituales.
Hay una conversión global simultánea, hasta tres intentos automáticos y un tiempo máximo de 90 segundos
para LibreOffice y 20 segundos para la miniatura. El contenedor tiene 768 MB de memoria y una CPU como límites.
La cola conserva trabajos tras un reinicio y limpia los derivados después de eliminar el original.
El reintento manual se habilita un minuto después del último fallo.
Las fuentes instaladas incluyen Liberation, Carlito y Caladea. La distribución puede variar respecto
a Microsoft Office; las hojas Excel usan su configuración de impresión.
