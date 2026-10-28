# Cambios del módulo de administrador de Vaultly

## Resumen

Se implementó el panel de administrador tomando como base `app-cliente` y las referencias visuales proporcionadas. El desarrollo se publicó en `feature/admin` y posteriormente se integró mediante un merge local en `app-cliente`.

## Pantallas implementadas

### Planes y facturación

- Listado de planes persistidos en PostgreSQL con nombre, precio, almacenamiento, descargas, estado y acciones.
- Creación y edición de planes.
- Activación y desactivación con confirmación.
- Precio mensual en quetzales y almacenamiento en GB decimales.
- Descargas limitadas o ilimitadas, representadas mediante `null` en el modelo existente.
- Controles independientes para permitir carpetas públicas y activar el plan.
- Validaciones en frontend y backend, estados de carga, lista vacía, errores y mensajes de éxito.

### Administradores

- Listado y búsqueda por nombre o correo electrónico.
- Creación de usuarios con rol `ADMIN` utilizando las tablas existentes de usuarios y roles.
- Edición de nombre y correo electrónico.
- Activación y desactivación con confirmación, sin borrado definitivo.
- Visualización de nombre, correo, estado y fecha de creación.
- Validación de correo único y contraseñas mediante la política compartida del proyecto.
- Hash de contraseñas con bcrypt, sin exponer contraseñas ni hashes en las respuestas.
- Protección del último administrador activo y prevención de la desactivación de la propia cuenta.

### Configuración y sesión

- Visualización del perfil real del administrador autenticado.
- Solicitud de cambio de contraseña mediante el flujo de recuperación por correo existente.
- Cierre de sesión con limpieza del almacenamiento de sesión y redirección al login.
- Redirección por rol al iniciar sesión: administradores a `/admin/planes` y clientes a `/dashboard`.

### Diseño

- Menú con Planes y facturación, Administradores, Configuración y Cerrar sesión.
- Nombre e iniciales reales del administrador en la parte inferior del menú.
- Colores crema, naranja y café, bordes suaves y distribución basada en las referencias.
- Menú adaptable a móvil y tablas con desplazamiento horizontal.
- Iconos del panel disponibles localmente, sin depender de una consulta externa para mostrarlos.

## Arquitectura y seguridad

Se conservó la separación entre controladores HTTP, casos de uso, reglas de dominio, repositorios SQL y componentes de presentación. Se reutilizaron el cliente HTTP, la sesión, las políticas de contraseña y el modelo de datos existentes.

Los endpoints administrativos se encuentran bajo `/api/admin` y exigen autenticación y rol `ADMIN`. El middleware consulta el estado y rol actuales en PostgreSQL; una cuenta desactivada no puede seguir operando con un token anterior. El registro público continúa asignando exclusivamente el rol `CLIENTE`.

Las operaciones administrativas utilizan transacciones y bloqueos para proteger las reglas de acceso incluso ante solicitudes concurrentes. Las cuentas desactivadas se guardan como `BLOQUEADO`, ya que `INACTIVO` representa correos pendientes de verificación en el flujo existente.

## Protección de planes y suscripciones

- No se eliminan suscripciones ni registros de facturación.
- Los planes con suscripciones, incluidas las históricas, no permiten cambiar sus condiciones. Para ofrecer condiciones diferentes debe crearse otro plan.
- Esos planes pueden desactivarse para nuevas contrataciones, conservando las suscripciones existentes.
- El plan `Free` debe conservar su nombre, precio cero y estado activo porque el registro y el servicio de cuotas dependen de él.
- Se mantiene la simulación de pagos existente; no se implementó una pasarela de pago real.

Está pendiente definir el versionado de condiciones para suscripciones vigentes y renovaciones. La restricción de edición evita introducir cambios retroactivos mientras se define esa política.

## Base de datos y acceso inicial

No se agregaron tablas, migraciones ni dependencias. Se utilizan las migraciones existentes del proyecto.

No se creó un administrador predeterminado en la base habitual ni se incluyeron credenciales en el código. Para el primer acceso se necesita una cuenta con rol `ADMIN` y estado `ACTIVO`. Una vez dentro del panel, las demás cuentas administrativas pueden crearse desde la sección Administradores.

Para ejecutar los cambios se debe reiniciar el backend y reconstruir o iniciar el frontend. La recuperación de contraseña requiere la configuración de correo existente.

## Verificaciones realizadas

Resultados obtenidos durante la implementación:

| Verificación | Resultado |
| --- | --- |
| Compilación del frontend | Correcta |
| Lint del frontend | Sin advertencias |
| Pruebas del backend | 86 aprobadas |
| Pruebas del frontend | 17 aprobadas |
| Pruebas de navegador | 8 aprobadas |
| Integración administrativa con PostgreSQL | Aprobada en una base temporal aislada |
| Validación de la secuencia de migraciones | Correcta |
| Revisión visual | Escritorio de 1366 px y móvil de 390 px |

Las pruebas de navegador utilizan respuestas HTTP controladas y cubren flujos administrativos, rechazo de clientes y cierre de sesión. La integración PostgreSQL comprueba persistencia, unicidad de correo, hash, edición, desactivación, concurrencia y conservación de suscripciones.

No se verificó la entrega real de correo SMTP ni se ejecutaron la suite completa de integración de MinIO/cuotas o la matriz histórica de migraciones durante esta tarea. El cierre de sesión conserva el mecanismo existente; no se añadió revocación de JWT en el servidor al hacer logout.

## Commits relacionados

- `415e576`: API segura de planes y administradores, reglas y pruebas del backend.
- `0a69b95`: panel adaptable, flujos administrativos, pruebas de navegador y documentación técnica.
- `96e3304`: merge de `feature/admin` en `app-cliente`.

Los comandos de ejecución, contratos de API y decisiones técnicas detalladas están disponibles en [docs/administracion.md](docs/administracion.md).
