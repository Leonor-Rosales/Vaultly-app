# Administración de Vaultly

## Ejecución y rutas

No se añaden migraciones ni dependencias. Se usan las tablas existentes `usuarios`,
`roles`, `planes` y `suscripciones`, con las migraciones 01–07 del repositorio.
En instalaciones anteriores, ejecutar primero el migrador documentado en el README.
Reiniciar el backend y reconstruir el frontend:

```powershell
npm --prefix backend run migrate:check
npm --prefix frontend run build
npm --prefix backend start
```

Entrar con una cuenta existente de rol `ADMIN` y estado `ACTIVO`. El login dirige a
`/admin/planes`; los clientes continúan en `/dashboard`. No se incluyen credenciales
por defecto ni se habilita la elección de rol en el registro público.

- `/admin/planes`: catálogo completo, creación, edición y cambio de estado.
- `/admin/administradores`: búsqueda local por nombre/correo, alta, edición y estado.
- `/admin/configuracion`: perfil de sesión y solicitud real de recuperación de contraseña.

La configuración SMTP existente es necesaria para recibir el correo de recuperación.
La UI no anuncia envío si la API falla. Los datos de perfil se editan en Administradores.

## Capas y contratos

`controllers/adminRoutes` autentica, exige ADMIN y adapta HTTP; los casos de uso en
`usecases/administracion` coordinan validación, autorización y persistencia.
`domain/administracion` contiene reglas; `infrastructure/adminRepositorio` contiene
SQL parametrizado y transacciones. React usa `services/admin`, que reutiliza el cliente
HTTP de autenticación. No hay SQL ni políticas de suscripciones en componentes.

API bajo `/api/admin`: GET/POST `/planes`, PUT `/planes/:id`, GET/POST
`/administradores`, PUT `/administradores/:id`. PUT recibe el formulario completo.
Los identificadores y campos se validan; errores de dominio retornan 400/403/404/409.
No existe DELETE. Se omiten hashes y contraseñas de todas las respuestas.

Planes: `nombre`, `precio_mensual` numérico en quetzales (hasta dos decimales),
`cuota_storage_gb` entero positivo en GB decimales (1 GB = 1 000 000 000 bytes,
según `shared/usage-policy.json`), `limite_descargas` entero no negativo o `null`
para ilimitadas, `permite_carpetas_publicas` y `activo` booleanos independientes.

Administradores: `nombre_completo`, `correo_electronico`, `activo`; `password` solo
en creación. Se reutiliza la política compartida y bcrypt del proyecto. El correo
se normaliza y la restricción única existente evita duplicados concurrentes.
Las cuentas desactivadas se guardan como `BLOQUEADO`: `INACTIVO` está reservado por
el flujo existente para correos pendientes, que podrían activarse con un enlace.
El alta administrativa crea la cuenta directamente; no existe flujo de invitación.
La recuperación existente permite al titular establecer otra contraseña.

El middleware de sesión consulta estado y rol actuales en PostgreSQL en todas las
rutas autenticadas. Un token anterior no permite operar tras desactivar la cuenta.
Las mutaciones vuelven a comprobar al actor dentro de la transacción. El logout usa
el mecanismo existente: elimina almacenamiento local/de sesión, limpia consumo,
notifica otras pestañas y redirige al login. Los JWT mantienen la duración existente
de dos horas; no se introduce una lista de revocación de tokens al cerrar sesión.

## Suscripciones: decisión pendiente y protección provisional

El sistema consulta condiciones directamente desde `planes`; no conserva versiones
por suscripción. **Está pendiente definir cómo versionar precios y beneficios para
suscripciones existentes y renovaciones.** Hasta entonces, cualquier plan referenciado
por una suscripción (incluidas históricas) conserva nombre, precio, almacenamiento,
descargas y permiso de carpetas públicas. Intentar cambiarlos devuelve 409 con una
explicación; se puede crear otro plan. Su estado sí se puede cambiar: el catálogo
del cliente excluye planes inactivos y las suscripciones vigentes siguen consultando
sus condiciones. No se modifican ni eliminan suscripciones o pagos.

`Free` debe mantener nombre, precio cero y estado activo: el trigger de alta y el
servicio de cuotas lo requieren. El trigger existente también asigna Free a las
cuentas administrativas; se conserva este comportamiento para compatibilidad.
No se agrega pasarela ni se modifica la simulación de pagos existente.

Las escrituras administrativas toman un bloqueo transaccional EXCLUSIVE de `usuarios`
antes de leer/modificar. Esto serializa activaciones y desactivaciones, protege al
último administrador y coordina con los SELECT FOR UPDATE de contratación/cuotas.
Para planes también se bloquean escrituras de `suscripciones` antes de comprobar
referencias. Son operaciones cortas; hash de contraseña se calcula antes del bloqueo.
Un timeout de diez segundos devuelve conflicto recuperable. El bloqueo es amplio:
para un catálogo con gran volumen de escrituras concurrentes convendría sustituirlo
por coordinación más granular en todos los repositorios participantes.

## Verificación reproducible

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix backend test
npm --prefix backend run migrate:check
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix frontend run test:e2e
$env:TEST_ADMIN_DATABASE_URL='postgresql://postgres:CLAVE_TEMPORAL@127.0.0.1:57081/vaultly_admin_test'
npm --prefix backend run test:admin
```

La integración exige una base local exclusiva `vaultly_admin_test`, crea un esquema
único y lo conserva para inspección. Nunca usa la base de la aplicación. Comprueba
persistencia, unicidad, hash, edición, desactivación, concurrencia entre dos admins,
protección del último activo y conservación de suscripciones al desactivar planes.

Las pruebas HTTP cubren todos los endpoints administrativos con cliente, sesión
ausente, token inválido y cuenta bloqueada. Las pruebas de navegador usan respuestas
HTTP controladas: verifican flujos de creación/edición/estado, búsqueda, configuración,
logout, rechazo de cliente y pantallas a 1366/390 px. No sustituyen la integración SQL.
Las capturas se generan en `frontend/test-results` (ignorado por Git).

No se verificó entrega de correo SMTP real ni cobro: la facturación sigue siendo
la simulación del repositorio. La suite de integración completa de MinIO/cuotas y
la matriz histórica de migraciones tienen comandos separados y no forman parte
de `test:admin`.
