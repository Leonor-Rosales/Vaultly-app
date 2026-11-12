# Despliegue en Oracle Cloud con Docker Compose

Este es el camino activo de `feature/adaptaciones`. El plan Vercel/Neon/R2 queda
como alternativa histórica. Toda la aplicación se ejecuta en una máquina Ubuntu
24.04 ARM: PostgreSQL, MinIO, API, worker LibreOffice y web con Caddy.

## Configuración inicial

Requisitos: máquina Ampere A1 con 2 OCPU y 12 GB, disco predeterminado, Docker
Engine/Compose y acceso SSH. Las imágenes MinIO y mc de `compose.production.yml`
están fijadas a manifiestos que incluyen ARM64. Los builds propios se construyen
en la arquitectura del servidor.

La instalación usa un archivo Compose independiente. Usar siempre
`--env-file .env.production -f compose.production.yml`: el Compose de desarrollo y
su override no deben mezclarse con producción. No se instalan Mailpit ni Node en
el host. Solo la entrada web publica puertos; PostgreSQL y MinIO son internos.

En Ubuntu, desde la carpeta del repositorio:

```bash
git switch feature/adaptaciones
git pull --ff-only origin feature/adaptaciones
sudo docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:24-bookworm-slim \
  node scripts/preparar-produccion.cjs
sudo docker compose --env-file .env.production -f compose.production.yml config --quiet
sudo docker compose --env-file .env.production -f compose.production.yml up -d --build
sudo docker compose --env-file .env.production -f compose.production.yml ps -a
```

El generador crea `.env.production` con permiso 600 en Linux y secretos aleatorios
distintos para PostgreSQL, MinIO y JWT. No los imprime ni reemplaza un archivo ya
existente. No compartirlo, no ejecutar `compose config` sin `--quiet` para pegar su
salida, ni regenerar contraseñas con volúmenes existentes. `.gitignore` lo excluye.

`migrar` y `minio-init` deben terminar con código 0. `backend` espera a ambos;
`web` espera a la salud de la API. El worker usa la misma base y bucket, sin lanzar
un segundo migrador (`MIGRATE_ON_STARTUP=false`). El worker local conserva su
comportamiento anterior cuando no recibe esa variable.

## Primera comprobación por SSH

La configuración inicial publica solo en `127.0.0.1:8080` del servidor. Dejar los
puertos web de Oracle cerrados en esta etapa. En el servidor:

```bash
curl -fsS http://127.0.0.1:8080/api/health
```

En otra ventana PowerShell de la computadora del usuario, usando su IP y clave:

```powershell
ssh -i "$env:USERPROFILE\Downloads\private.key" -N -L 8080:127.0.0.1:8080 ubuntu@IP_PUBLICA
```

Mantener esa ventana abierta y abrir `http://localhost:8080` en el navegador.
Si el puerto local 8080 está ocupado, elegir otro puerto local y ajustar
`PUBLIC_URL` para que los enlaces de correo coincidan. No abrir la IP pública en
HTTP para ingresar contraseñas. No exponer las consolas MinIO/PostgreSQL.

## Administrador inicial

La base nueva no incluye usuarios con contraseñas predeterminadas. Solo desde la
consola del servidor, con un correo real controlado por el responsable:

```bash
sudo docker compose --env-file .env.production -f compose.production.yml exec backend \
  node scripts/crear-admin-inicial.js correo-del-responsable@example.com
```

El script crea el primer administrador activo y muestra una contraseña aleatoria
una sola vez. Guardarla en privado; no pegar su salida en chats ni capturas.
Rechaza instalaciones donde ya existe algún administrador y nunca cambia una
cuenta existente. Este acceso inicial se establece por consola, no verifica la
propiedad del correo; el operador debe usar un correo que controle. Las demás
cuentas continúan con la verificación normal de la aplicación.

## Correo

Completar `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` y `MAIL_FROM` dentro de
`.env.production` con el proveedor elegido. Para editar puede usarse un editor
local seguro o instalar `nano` en Ubuntu. No utilizar la contraseña de Oracle ni
guardar credenciales en Git.

Después de cambiar el correo:

```bash
sudo docker compose --env-file .env.production -f compose.production.yml up -d backend
```

Sin correo configurado se puede comprobar la web y entrar con el administrador
inicial, pero no dar por aprobado registro, verificación o recuperación. Probar
los envíos reales antes de la presentación.

## Publicación con HTTPS

Elegir un nombre DNS que resuelva a la IP pública y confirmar su resolución antes
de solicitar el certificado. Esta instalación no registra un dominio. Actualizar
solo estas variables en el archivo existente, conservando los secretos:

```dotenv
PUBLIC_URL=https://nombre-publico-elegido
SITE_ADDRESS=nombre-publico-elegido
WEB_BIND_IP=0.0.0.0
HTTP_PORT=80
HTTPS_PORT=443
```

Abrir TCP 80 y 443 en la lista de seguridad/NSG de la subred pública en Oracle y
revisar las reglas del host. Mantener SSH restringido a la IP de administración
cuando sea posible. No vaciar iptables ni desactivar el firewall para solucionar
conectividad. Docker publica puertos mediante sus propias reglas, por lo que no
se debe confiar solo en UFW para proteger puertos de contenedores.

Aplicar y comprobar:

```bash
sudo docker compose --env-file .env.production -f compose.production.yml up -d
sudo docker compose --env-file .env.production -f compose.production.yml logs --tail 50 web
```

Caddy gestiona HTTPS para el nombre configurado y conserva certificados en sus
volúmenes. `/api` llega a Express conservando el prefijo; las rutas React reciben
`index.html`. `VITE_API_URL` se compila vacío para usar siempre el mismo origen.

## Actualizaciones y respaldo

Antes de migraciones o cambios, guardar un respaldo de PostgreSQL y de los objetos
MinIO fuera de la máquina. Los volúmenes sobreviven a recrear contenedores, pero no
constituyen por sí mismos un respaldo ni protegen frente a perder la instancia.
La cuota anunciada de planes (hasta 100 GB) no reserva disco físico; vigilar espacio
real y limitar los archivos de ensayo al almacenamiento disponible.

Respaldo SQL privado en el servidor (copiarlo luego a un destino seguro):

```bash
umask 077
mkdir -p backups
sudo docker compose --env-file .env.production -f compose.production.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backups/vaultly-$(date +%Y%m%d-%H%M%S).sql"
```

Actualización con parada de los consumidores mientras se aplica el esquema:

```bash
git pull --ff-only origin feature/adaptaciones
sudo docker compose --env-file .env.production -f compose.production.yml build
sudo docker compose --env-file .env.production -f compose.production.yml stop backend vistas-previas
sudo docker compose --env-file .env.production -f compose.production.yml run --rm migrar
# Continuar solo si el migrador termina correctamente.
sudo docker compose --env-file .env.production -f compose.production.yml up -d
```

No ejecutar `down -v`, borrar volúmenes ni usar comandos de limpieza global de
Docker sobre una instalación con datos. Un rollback del código no revierte el SQL.

## Verificaciones para cerrar el despliegue

- API saludable, inicio de sesión y rutas internas React correctos.
- Subida/descarga, cuota, propiedad, biblioteca, papelera y persistencia al reiniciar.
- DOCX/XLSX generan PDF/miniatura en el worker ARM del servidor.
- Correo real y enlaces HTTPS correctos; acceso desde otro dispositivo.
- Sin puertos públicos de PostgreSQL, MinIO o backend y sin secretos en imágenes.
- Revisar los avisos de dependencias ya documentados antes de abrir la aplicación.
- Revisar consumo/costos y elegibilidad Always Free de los recursos creados en OCI.

Fuentes: [Compose en producción](https://docs.docker.com/compose/how-tos/production/),
[proxy Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[HTTPS Caddy](https://caddyserver.com/docs/automatic-https),
[Docker y firewall](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

## Evidencia de preparación local (12 de noviembre de 2026)

- Validación de Compose sin imprimir secretos y construcción de todas las imágenes.
- Build del frontend dentro de Docker: TypeScript y Vite aprobados.
- 133 pruebas de backend aprobadas, incluida protección del administrador inicial.
- Arranque completo en `vaultly-oci-ensayo`, con volúmenes de prueba nuevos y puertos
  vinculados solamente a loopback; migraciones y bucket privado finalizaron bien.
- Comprobación HTTP a través de Caddy: salud, ruta React, rechazo sin sesión, alta
  inicial y login de administrador, rechazo de una segunda inicialización, consumo,
  subidas/descargas TXT, DOCX y XLSX, rechazo entre usuarios, papelera y generación
  real de PDF y miniatura para ambos formatos Office.

Estas pruebas se ejecutaron con Docker Linux amd64 local. Se verificó que los
manifiestos fijados de MinIO/mc incluyen ARM64, pero queda por ejecutar el build
propio y repetir la comprobación en el servidor ARM de Oracle. También quedan
pendientes correo real, DNS/HTTPS, publicación externa y verificación de costos.
