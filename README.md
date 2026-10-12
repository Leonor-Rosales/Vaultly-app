# Vaultly-app
Plataforma de almacenamiento en la nube

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
Deben aparecer 16 tablas y 4 planes.
Los scripts no se ejecutan nuevamente al reiniciar

Para una base existente, con el backend detenido y su conexión local ya configurada:

```powershell
npm --prefix backend run migrate
```

La migración es idempotente y conserva usuarios, archivos y volúmenes.
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
