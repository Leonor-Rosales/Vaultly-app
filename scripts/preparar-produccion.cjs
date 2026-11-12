// Ejecutar con Node o con una imagen Node montando el repositorio en /workspace.
// Genera secretos locales sin imprimirlos y nunca reemplaza un archivo existente.
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function preparar(destino = '.env.production') {
  const archivo = path.resolve(destino);
  const secreto = () => randomBytes(32).toString('hex');
  const contenido = `# Ensayo local en el servidor; acceso mediante túnel SSH.
# Para publicar con HTTPS, seguir docs/despliegue-oracle.md.
COMPOSE_PROJECT_NAME=vaultly-produccion
PUBLIC_URL=http://localhost:8080
SITE_ADDRESS=:80
WEB_BIND_IP=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443

POSTGRES_DB=vaultly_db
POSTGRES_USER=vaultly_admin
POSTGRES_PASSWORD=${secreto()}
MINIO_ROOT_USER=vaultly_minio_admin
MINIO_ROOT_PASSWORD=${secreto()}
MINIO_BUCKET=vaultly-files
JWT_SECRET=${secreto()}

# Completar antes de probar registro/verificación/recuperación por correo.
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
`;
  fs.writeFileSync(archivo, contenido, { flag: 'wx', mode: 0o600 });
  console.log('Configuración creada con secretos nuevos. No compartas su contenido.');
  console.log('La web queda restringida a 127.0.0.1:8080 hasta configurar HTTPS.');
}

if (require.main === module) {
  try { preparar(process.argv[2]); }
  catch (error) {
    console.error(error.code === 'EEXIST'
      ? 'El archivo ya existe; se conserva para no cambiar las credenciales de los volúmenes.'
      : 'No se pudo crear la configuración: ' + error.message);
    process.exitCode = 1;
  }
}
module.exports = { preparar };
