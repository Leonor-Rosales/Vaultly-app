# Plan de adaptación a Vercel, Neon y Cloudflare R2

> Alternativa histórica. El usuario eligió continuar con Oracle Cloud y Docker;
> consultar [el despliegue activo](despliegue-oracle.md).

Fecha de revisión: 12 de noviembre de 2026.
Rama de trabajo: `feature/adaptaciones`, creada desde `feature/propuesta`.

## Objetivo y decisiones confirmadas

Publicar Vaultly para una presentación académica, con una dirección HTTPS y sin
depender de la computadora del presentador. Conservar autenticación, administración,
planes, cuotas, biblioteca, carpetas, papelera y todas las vistas previas actuales,
incluidas DOCX y XLSX. Se conservan React/Vite, Express y PostgreSQL.

La aplicación web y la API se alojarán en Vercel, los datos relacionales en Neon y
los archivos en un bucket privado R2. Docker continúa como entorno local y como
candidato para empaquetar LibreOffice. El Compose local no se publica sin cambios.

No hay recursos cloud creados ni un despliegue de ensayo validado todavía. La
gratuidad completa, especialmente de la conversión Office, está por comprobar.

## Estado inicial comprobado en el código

| Área | Implementación de partida | Adaptación necesaria |
| --- | --- | --- |
| API | `backend/src/server.js` construía Express, iniciaba tareas y escuchaba un puerto | Separar aplicación, arranque local y mantenimiento |
| PostgreSQL | `pg.Pool` con variables `DB_*`, sin configuración TLS para Neon | Agregar conexión segura, límites de conexiones y configuración cloud |
| Migraciones | Bloqueo de sesión `pg_advisory_lock` | Usar conexión directa independiente de la conexión agrupada de la API |
| Almacenamiento | Adaptador y cliente MinIO; algunas columnas conservan nombres de MinIO | Agregar R2 detrás del puerto de almacenamiento sin renombrar el esquema innecesariamente |
| Subidas activas | `POST /api/archivos`, multipart en memoria, máximo 50 MiB | Subida directa a R2 con reserva y confirmación verificadas |
| Descargas | Backend transmite el objeto, consume cuota al enviar cabeceras y cuenta al terminar | Preservar ese contrato o acordar expresamente su modificación |
| Office | Worker continuo con LibreOffice y Poppler; cola PostgreSQL | Una ejecución acotada por trabajo, con recuperación tras interrupciones |
| Exclusión del conversor | Bloqueo de sesión PostgreSQL | Usar conexión directa o sustituirlo por reclamación transaccional con vencimiento |
| Mantenimiento | Temporizadores de un minuto y una hora | Trabajos invocables, autenticados, acotados e idempotentes |
| Correo | Nodemailer/SMTP; Mailpit solo local | Verificar proveedor, remitente y enlaces públicos en un envío real |
| Frontend | Servicios con `VITE_API_URL` y respaldo localhost | Unificar configuración cloud, rutas SPA y acceso a archivos |

El archivo `subidaController.js` contiene una ruta antigua; la adaptación de
subidas debe seguir la ruta realmente montada en `archivosRoutes.js` y sus casos
de uso. Antes de cada cambio se comprobarán los consumidores activos.

## Etapa 0: demostrar la viabilidad de Office

La documentación de Vercel describe un Container Runtime en beta para todos los
planes. Permite instalar dependencias del sistema y atender HTTP desde una imagen
OCI. Esto proporciona una alternativa a contratar otro servidor para LibreOffice,
pero no prueba que la imagen actual de Vaultly funcione allí.

Propuesta a validar: un servicio de conversión en Vercel empaquetado con Docker,
separado de la API ordinaria. Cada petición autorizada reclama como máximo un
trabajo, descarga su original privado de R2, genera PDF y miniatura, guarda ambos
en R2 y termina. No se ejecuta el bucle infinito del worker actual ni se confía
en tareas lanzadas sin esperar su finalización. No recibe URLs arbitrarias del
navegador; el objeto autorizado se obtiene desde la base de datos.

La cola permanece en Neon. Los trabajos necesitan exclusión entre instancias,
intentos limitados y recuperación si la función vence o se reinicia. La conexión
agrupada de Neon no debe utilizarse con el bloqueo de sesión actual.

Validación pendiente:

- Comprobar el tamaño de las capas, la imagen, archivos temporales y disponibilidad
  del runtime en la cuenta concreta de Vercel.
- Convertir un DOCX y un XLSX representativos; abrir PDF y miniatura y comprobar
  contenido, tiempos, memoria y limpieza de temporales.
- Repetir con dos solicitudes simultáneas, documento defectuoso y trabajo
  interrumpido. No procesar el mismo trabajo simultáneamente ni marcarlo listo
  antes de guardar ambos derivados.
- Validar en Vercel, además de Docker local: arranque en frío, límite de duración,
  espacio temporal, permisos y acceso a Neon/R2.
- Definir activación durable del trabajo después de confirmar la subida. La
  petición puede esperar una ejecución acotada o usar un mecanismo con reintentos;
  un `fetch` abandonado después de responder no es una cola durable.
- Revisar cómputo, compilación y almacenamiento de imágenes. La documentación de
  VCR publica un precio de almacenamiento; disponibilidad en Hobby no equivale
  a gratuidad demostrada de todo el flujo.

**Criterio de cierre:** originales y derivados privados, DOCX y XLSX correctos en
un despliegue de ensayo, recuperación de fallos y costo/cuotas comprobados. Si el
runtime no resulta viable, documentar la evidencia y elegir otro ejecutor para
LibreOffice manteniendo las vistas previas. No sustituirlas por descarga solamente.

## Etapa 1: preparar la API

- [x] Extraer la composición de rutas a `backend/src/app.js`.
- [x] Exportar Express desde `server.js` sin escuchar puertos al importarlo.
- [x] Mantener `npm --prefix backend start` y `dev` para uso local.
- [x] Extraer tareas invocables y dejar los temporizadores solo en el arranque local.
- [ ] Configurar raíz de proyecto y empaquetado Vercel considerando `shared/`.
- [ ] Configurar URLs públicas, rutas SPA, CORS y secretos por entorno.
- [ ] Incorporar comprobaciones de salud sin revelar secretos.

**Criterio de cierre:** importar la API no dispara consultas ni tareas periódicas;
el modo local funciona y las rutas reales responden en el despliegue de ensayo.
La extracción inicial no implica que la aplicación ya esté adaptada a R2/Neon.

## Etapa 2: conectar Neon

- Admitir una URL de conexión segura y conservar `DB_*` para desarrollo local.
- Usar la conexión agrupada en la API con un pool acotado y reutilizado.
- Reservar una URL directa para migraciones y para cualquier operación que aún
  necesite bloqueo de sesión. No desactivar la validación TLS indiscriminadamente.
- Ejecutar el migrador explícitamente sobre una base de ensayo, nunca por cada
  importación, petición ni arranque en frío.
- Probar transacciones, restricciones, cuotas concurrentes y migraciones repetidas.
- Decidir entre datos de demostración e importación de datos existentes. Si se
  importa, respaldar primero y preservar identificadores y claves de objetos.

**Criterio de cierre:** esquema completo y pruebas relacionales en Neon de ensayo,
sin duplicar migraciones, pagos ni reservas.

## Etapa 3: integrar R2 y las subidas directas

- Crear un adaptador R2 y seleccionar explícitamente el proveedor por entorno.
- Provisionar el bucket fuera de las peticiones ordinarias; aplicar acceso privado,
  permisos mínimos de credenciales y CORS para los orígenes autorizados.
- Implementar iniciar, confirmar y cancelar subida. El servidor genera la clave y
  conserva usuario, reserva, tamaño esperado y metadatos autorizados en PostgreSQL.
- Reservar cuota antes de entregar la URL temporal. El navegador sube el objeto
  directamente a R2; las credenciales nunca llegan al frontend.
- Confirmar con metadatos reales del objeto, tamaño y validaciones necesarias.
  Revalidar propietario, carpeta, cuota y vigencia de la reserva; no confiar en un
  aviso del navegador de que la subida terminó.
- Garantizar confirmación idempotente y evitar cambios del objeto después de
  validarlo: una URL PUT sigue siendo reutilizable hasta vencer. Diseñar claves
  de preparación y promoción a una clave final que el navegador no pueda escribir,
  o un mecanismo equivalente comprobado.
- Contemplar tamaño manipulado, cancelación, reintentos, subida tardía después de
  vencer la reserva y limpieza posterior al vencimiento de la URL. Una URL firmada
  por sí sola no garantiza la cuota ni evita objetos huérfanos.
- Mantener inicialmente el límite activo de 50 MiB, salvo cambio explícito.
- Adaptar el cliente y probar un archivo mayor que 4.5 MB sin enviarlo por la API.

**Criterio de cierre:** un archivo se registra una sola vez, nunca supera la cuota
confirmada y los objetos fallidos o abandonados se recuperan con un proceso definido.

## Etapa 4: descargas, biblioteca y vistas previas

Conservar como propuesta inicial las descargas contabilizadas transmitidas por la
API: las respuestas en streaming tienen tratamiento distinto de las respuestas
almacenadas completas, aunque siguen sujetas a duración y consumo de Vercel.
Validar con archivos representativos antes de cerrar esta decisión.

El sistema actual consume cuota al enviar cabeceras e incrementa el contador tras
finalizar la transmisión. Pasar a enlaces GET firmados directos alteraría esa
observabilidad: emitir un enlace no demuestra una descarga completa y el enlace
puede reutilizarse durante su vigencia. No cambiar esos contratos silenciosamente.

Para vistas previas, evaluar enlaces temporales después de autorizar cada acceso,
incluyendo solicitudes Range de PDF/audio/video, tipos MIME, descarga de contenido
activo y CORS. Ninguna vista previa debe consumir cuota de descarga si hoy no lo
hace. Confirmar que archivos privados, eliminados y derivados siguen protegidos.

**Criterio de cierre:** biblioteca y archivos privados mantienen permisos, cuotas y
contadores; funcionan PDF, imágenes, texto, CSV/TSV, audio/video y DOCX/XLSX.

## Etapa 5: mantenimiento y correo

- Exponer trabajos internos autenticados, con lotes limitados y coordinación entre
  instancias. Reintentar errores sin duplicar avisos ni cambios de estado.
- Definir frecuencia para papelera, reservas, planes y avisos. El cron diario de
  Hobby no reproduce los temporizadores actuales; evaluar activación por operación
  y un mecanismo de planificación adicional si la frecuencia lo exige.
- Una tarea no debe reportar éxito si falló internamente. Los envoltorios locales
  actuales registran los errores; la futura interfaz de trabajos necesita propagar
  estados para permitir reintentos y seguimiento.
- Configurar el correo de verificación, recuperación y cambio de correo con un
  proveedor accesible desde Vercel y probar remitente y enlaces HTTPS reales.
- Mantener fuera del despliegue público Mailpit y credenciales de prueba.

## Etapa 6: ensayo, publicación y recuperación

1. Crear entornos de ensayo separados para Neon y R2, y configurar secretos en
   Vercel sin guardarlos en Git ni en variables `VITE_*`.
2. Validar migraciones, pruebas de backend, build y pruebas pertinentes del frontend.
3. Probar registro/correo, inicio de sesión, recuperación, administración, planes,
   cuotas, carpetas, biblioteca, papelera y todas las vistas previas.
4. Probar subidas simultáneas, fallos de red, confirmaciones duplicadas, accesos entre
   usuarios y operaciones sobre archivos eliminados.
5. Si se trasladan datos, copiar originales y derivados con verificación antes de
   cambiar el destino. No borrar volúmenes locales durante la migración.
6. Publicar, comprobar desde otro dispositivo y documentar respaldo, reversión de
   aplicación y recuperación de datos. Revertir código no revierte una migración SQL.
7. Revisar consumo y límites de los tres proveedores con los archivos de la clase.

## Fuentes y alcance de la validación

Documentación consultada el 12 de noviembre de 2026:

- [Express en Vercel](https://vercel.com/docs/frameworks/backend/express).
- [Container Runtime: beta, HTTP y escalado](https://vercel.com/docs/functions/runtimes/container).
- [Límites y precio del registro de imágenes](https://vercel.com/docs/container-registry/limits-and-pricing).
- [Límites de funciones y solicitudes](https://vercel.com/docs/functions/limitations).
- [Cron: uso y restricciones](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).
- [Pool de conexiones de Neon](https://neon.com/docs/connect/connection-pooling).
- [URLs temporales R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
- [CORS R2](https://developers.cloudflare.com/r2/buckets/cors/).
- [Precios R2](https://developers.cloudflare.com/r2/pricing/).

La disponibilidad documentada de contenedores permite proponer la prueba de
LibreOffice en Vercel. No equivale a una prueba de conversión desplegada ni confirma
costo cero. Esos resultados se registrarán cuando se ejecute el ensayo real.

### Ensayo local del conversor HTTP

Se agregó `backend/Dockerfile.vistas-previas-http`, con LibreOffice, Poppler y un
servidor HTTP que revisa como máximo un trabajo por petición. El worker continuo
existente se conserva. El nuevo servicio sigue usando PostgreSQL/MinIO y debe
adaptarse a Neon/R2 antes del ensayo cloud; no crea el esquema automáticamente.

- `GET /health`: comprobación de vida del proceso; no comprueba dependencias.
- `POST /internal/procesar-vista-previa`: requiere `Authorization: Bearer ...`
  con `VISTAS_PREVIAS_SECRET` de al menos 32 caracteres, generado aleatoriamente.
- Devuelve 409 si otra petición ocupa la misma instancia y 503 si no puede revisar
  la cola. El estado de conversión se consulta en PostgreSQL; un HTTP 200 no
  significa que se haya convertido un archivo o que la cola esté vacía.
- La exclusión entre instancias continúa dependiendo del bloqueo de sesión del
  repositorio. No usar la conexión agrupada de Neon para ese repositorio actual.

Reproducción del ensayo desde la raíz del repositorio (Python 3 y Docker):

```powershell
python backend/scripts/crear-fixtures-office.py ../tmp/vaultly-office-adaptaciones
docker build -f backend/Dockerfile.vistas-previas-http -t vaultly-office-http-prueba .
$fixturesOffice = (Resolve-Path ../tmp/vaultly-office-adaptaciones).Path
docker run --rm --network none --read-only --memory 2g --cpus 1 --pids-limit 128 --tmpfs /tmp:size=512m,mode=1777 --mount "type=bind,source=$fixturesOffice,target=/ensayo,readonly" vaultly-office-http-prueba node scripts/probar-office-contenedor.js /ensayo
```

Resultado del 12 de noviembre: ambos documentos sintéticos generaron PDF con el
texto esperado y miniatura PNG; no quedaron directorios temporales del conversor.
La solicitud sin secreto fue rechazada antes de convertir.

| Formato | Duración local | PDF | Miniatura |
| --- | --- | --- | --- |
| DOCX | 1772 ms | 7103 bytes | 3060 bytes, 495 × 640 |
| XLSX | 1668 ms | 9337 bytes | 3140 bytes, 453 × 640 |

Imagen local: 1010252870 bytes sin comprimir, arquitectura amd64. No confundir ese
tamaño con el tamaño comprimido facturable de VCR. La ejecución limitó el contenedor
a 2 GiB de memoria y un CPU; no midió el pico total de LibreOffice. El RSS que
imprime el script corresponde a Node, no a todos sus subprocesos. El ensayo aisló
la conversión de Neon, MinIO y R2; no modifica archivos de usuarios.

Se aprobaron 132 pruebas de backend, incluidas autorización HTTP, rechazo de
solapamientos, espera de finalización y reintento después de un error de dependencia.
El proceso HTTP, su imagen y esta prueba todavía no equivalen a un despliegue en
Vercel ni a una prueba completa de la cola en Neon.

### Preparación de cuentas para el ensayo cloud

El usuario indicó que aún no tiene las cuentas. El código puede seguir preparándose
localmente; las verificaciones en proveedores necesitan estos pasos:

1. Crear una cuenta personal en [Vercel](https://vercel.com/signup), preferentemente
   con GitHub. Usar Hobby para el ensayo académico. Al importar el repositorio,
   trabajar exclusivamente con `feature/adaptaciones`; revisar la rama de producción
   antes de conectar un proyecto. La configuración de publicación se definirá
   después de adaptar los servicios.
2. Crear una cuenta en [Neon](https://console.neon.tech/) y un proyecto de ensayo
   `vaultly-adaptaciones` en Free. Guardar de forma privada las conexiones agrupada
   y directa. No ejecutar migraciones sobre otra base ni poner conexiones en Git.
3. Crear una cuenta en [Cloudflare](https://dash.cloudflare.com/), abrir
   Storage & databases > R2 > Overview y completar la activación de R2. El flujo
   incluye una suscripción y puede solicitar datos de facturación; comprobar las
   cuotas gratuitas y cargos por exceso antes de completarlo.
4. Crear un bucket de ensayo `vaultly-adaptaciones` en almacenamiento Standard,
   sin acceso público. Las credenciales y CORS se configurarán al integrar R2.
5. Introducir los secretos en los ajustes de los proveedores o en archivos locales
   ignorados por Git. No compartir claves, conexiones ni contraseñas en el chat.

Antes de publicar se revisarán también los avisos de dependencias: la compilación
actual de la imagen informó nueve vulnerabilidades (seis altas). Ese resumen de
`npm ci` requiere revisar el informe detallado; no se aplicará `audit fix --force`
sin evaluar sus cambios. Aún no se ha expuesto este servicio públicamente.

### Verificaciones del primer cambio

- `npm --prefix backend test`: 129 pruebas aprobadas, cero fallos. Incluye pruebas
  nuevas que impiden abrir puertos, iniciar temporizadores o consultar PostgreSQL
  al importar `server.js`, y verifican reintentos del mantenimiento sin solapamiento.
- La extracción conserva la composición de las rutas existentes y no cambia el
  adaptador MinIO, el acceso PostgreSQL ni el worker de vistas previas.
- Falta comprobar arranque local contra datos de ensayo y despliegue cloud. Las
  pruebas unitarias no sustituyen la conversión real de documentos en Vercel.
