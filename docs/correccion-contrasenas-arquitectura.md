# Autenticación, contraseñas y almacenamiento: estado actual

## Base y alcance de esta revisión

Trabajo en `correccion-arquitectura-backend`, creada desde la referencia actualizada
`origin/app-cliente`, commit `83eb150`. El árbol estaba limpio al comenzar.
La revisión anterior ya está incluida en ese commit: no debe describirse como trabajo
sin publicar. Esta revisión deja modificaciones locales para revisar; el agente no
realizó commit, merge, push ni despliegue. La rama se creó con `--no-track` para no
publicar sobre la base; al cierre su seguimiento apunta a su propia rama remota,
`origin/correccion-arquitectura-backend`.

El usuario aclaró la contradicción del encargo: se permite corregir la lógica del
frontend y sus pruebas, conservando el diseño. No se modificaron `.env`, secretos,
esquema SQL, cuotas, suscripciones, pagos ni contadores de descargas.

## Implementado

### Autenticación y dependencias

- Los nueve módulos de autenticación en `backend/src/usecases/` exponen funciones
  constructoras que reciben sus dependencias. Conservan sus reglas y resultados.
- `usecases/auth.js` reúne los casos y documenta contratos sencillos para repositorio,
  hashing, tokens y correo. No importa adaptadores ni lee variables de entorno.
- `restablecerPassword.js` utiliza `repo.actualizarPassword(id, hash)`, ya existente:
  no contiene SQL. El repositorio devuelve una fila o null; null mantiene el 404.
- `infrastructure/usuarioRepositorio.js` traduce el error de unicidad PostgreSQL
  a un error de dominio 409. El caso de uso ya no conoce códigos del motor SQL.
- `controllers/authController.js` recibe los casos y la URL de redirección; conserva
  respuestas, códigos y redirecciones. `authRoutes.js` recibe controlador y middleware.
- `controllers/middleware/auth.js` recibe el verificador del token. El mismo middleware
  se inyecta en las rutas de autenticación y archivos.
- `server.js` es el punto de composición: conecta PostgreSQL, bcrypt, JWT, correo y
  configuración con los casos de uso y los controladores. La configuración externa
  y sus implementaciones siguen en infrastructure.

Dirección de dependencias:

`server → controladores HTTP → casos de uso → contratos inyectados`

`server → adaptadores de infrastructure que implementan esos contratos`

Se revisaron los módulos de autenticación y almacenamiento existentes; no es una
certificación de toda la arquitectura del proyecto. Los casos siguen usando el
`ErrorApp` existente con estado HTTP, una convención conservada para no reorganizar
el dominio. Se mantienen utilidades estándar de Node como UUID y path.

### Contraseñas y frontend

Backend y frontend conservan el mínimo de 8 caracteres, minúscula, mayúscula, número
y carácter especial que no sea espacio, además del máximo de 72 bytes UTF-8.
Las letras Unicode cuentan según su categoría y la longitud se cuenta por puntos
de código. No se recorta, transforma ni normaliza la contraseña. Bcrypt mantiene
coste 10. Registro y restablecimiento validan antes del hash y la persistencia;
login conserva la compatibilidad con contraseñas existentes.

En el navegador `TextEncoder` calcula los bytes. Superar el máximo implica
`valida = false` y nivel Baja, aunque se cumplan todos los requisitos visibles.
`errorPassword` impide el envío mediante los controles existentes de ambas pantallas
y devuelve: “La contraseña es demasiado larga. Usa una más corta.” El backend usa
el mismo mensaje. No se añadió un requisito visible de bytes ni nuevos elementos.

Únicos archivos modificados dentro de `frontend/`:

- `src/services/passwordPolicy.ts`: lógica del límite y mensaje.
- `test/passwordPolicy.test.mjs`: añade cobertura del mensaje, límites multibyte
  y ausencia de un requisito visual nuevo; conserva las pruebas anteriores.

No se modificaron CSS, componentes TSX, navegación ni `shared/password-policy.json`.
La conservación del diseño se comprobó mediante el diff de esos archivos y el build;
no se realizó una prueba visual en navegador. El indicador sigue apareciendo al
escribir y mantiene su lista, colores y distribución.

### Almacenamiento conservado

Los casos de uso de archivos siguen coordinando repositorio y almacenamiento
inyectados. Solo se adaptó la recepción del middleware en las rutas y su prueba HTTP.
Se mantienen los filtros por propietario, 404 para archivos ajenos, endpoints y
formatos de respuesta, descarga por streaming, limpieza al fallar metadatos, bucket
privado y límite técnico de 50 MiB en memoria en aquella revisión (sustituido después
por 1 GiB con recepción en disco; véase `avisos-limites.md`). La visibilidad sigue siendo metadato:
no concede acceso anónimo al bucket.

## Pruebas y resultados reales

Entorno: Node 24.19.0. No se usaron servicios o datos de producción, ni se enviaron
correos reales. Las pruebas HTTP levantan servidores efímeros de loopback; PostgreSQL,
MinIO, SMTP y la verificación JWT se sustituyen por dobles. Se prueba bcrypt real
para comprobar que no se alteran espacios ni mayúsculas.

| Comprobación | Resultado |
| --- | --- |
| `npm --prefix backend test` | 52 aprobadas, 0 fallidas |
| `npm --prefix frontend test` | 5 aprobadas, 0 fallidas |
| `npm --prefix frontend run lint -- src test` | Correcto, sin diagnósticos |
| `npm --prefix frontend run build` | Correcto: TypeScript y Vite |
| `git diff --check` | Correcto |

Al iniciar, las dos pruebas originales de frontend sobre nivel y paridad fallaban
por el máximo de bytes. Después de corregir la implementación pasan sin eliminar,
omitir ni debilitar pruebas. El lint general recorrió `node_modules` y produjo
advertencias de dependencias; no se presenta como una comprobación limpia. Se ejecutó
separadamente el lint acotado a `src` y `test`. Una primera ejecución aislada del test
HTTP falló por EACCES del entorno; la suite completa pasó al permitir loopback fuera
de ese aislamiento, sin cambiar ni omitir la prueba.

Cobertura de backend: registro, rol CLIENTE, cuenta pendiente, verificación (inválida,
activación, ya activa y bloqueada), reenvío, recuperación, perfil, login compatible,
contraseñas inválidas antes del hash/persistencia, normalización del correo sin
alterar contraseñas, resultado de fallo SMTP, errores DB, enlaces codificados,
traducción SQL del repositorio, rutas HTTP, autenticación y redirecciones.
Se conservan autorización y operaciones de archivos, fallo de stream, compensación
de subida y fallos parciales de eliminación. Los errores simulados que se imprimen
(SMTP, stream y error interno) son escenarios esperados, no pruebas fallidas.

Archivos de pruebas adaptados: `backend/test/auth.test.js` y `archivos-http.test.js`.
Nuevos: `backend/test/auth-flows.test.js` y `usuarioRepositorio.test.js`.
Los casos de uso y middleware se prueban por inyección directa. `loadWith.js` se
conserva para aislar el adaptador SQL de su conexión real.

Revisado solo en código: configuración privada del bucket, consultas de propiedad,
límite Multer de 50 MiB y cableado con adaptadores reales. No se probaron servicios
reales ni concurrencia distribuida, y no se realizó una auditoría integral de seguridad.

## Pendientes y limitaciones

- El texto aclaratorio del indicador no aparece actualmente en el componente:
  sigue pendiente explicar que cumplimiento y longitud no garantizan resistencia
  de una contraseña común. Se conserva pendiente para respetar el diseño solicitado.
- Los tokens de recuperación siguen siendo reutilizables hasta vencer; no hay
  consumo único ni invalidación tras cambiar contraseña. La revocación de sesiones
  existentes también queda pendiente de seguridad. No se declara solucionado.
- Eliminar en MinIO y PostgreSQL no es una transacción atómica. Se mantiene el orden
  objeto → registro. Si falla el segundo paso, puede quedar un registro sin objeto;
  si falla el primero, no se intenta borrar el registro. No hay reconciliación
  automática. Un reintento puede completar la limpieza gracias al borrado idempotente
  del objeto; concurrencia o resultados de red inciertos requieren revisión futura.
- Una compensación de subida fallida puede dejar un objeto huérfano. Se registra
  el error y se mantiene el fallo original. También puede quedar un resultado incierto
  si una operación remota termina pero se pierde su confirmación. Reconciliación,
  estados persistentes y reintentos están fuera del alcance de esta revisión.
- El envío SMTP aceptado no garantiza entrega final en la bandeja del destinatario.
  Se conservan los resultados actuales de registro y errores de recuperación/reenvío.
- El límite de subida es por archivo; subidas concurrentes siguen consumiendo memoria.
- Para ejecutar pruebas TypeScript, usar Node 22.18+ o 24. Al distribuir el monolito
  hay que conservar `shared/`, dependencia común del backend y frontend.

## Pasos para probar localmente

Desde la raíz de `Vaultly-app`:

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run lint -- src test
npm --prefix frontend run build
```

Para integración manual, con Docker Desktop y configuración exclusivamente de
pruebas ya preparada (no usar credenciales productivas):

1. Instalar dependencias si faltan con `npm --prefix backend install` y
   `npm --prefix frontend install`. Iniciar servicios con `docker compose up -d`.
2. En terminales separadas ejecutar `npm --prefix backend run dev` y
   `npm --prefix frontend run dev`. Abrir `http://localhost:5173`.
3. Registrar una cuenta local, verificarla, iniciar sesión, reenviar verificación
   y recuperar/restablecer contraseña con SMTP de pruebas. Probar correo caído:
   registro informa cuenta creada sin envío; recuperación/reenvío no anuncian éxito.
4. Probar contraseñas sintéticas de 8 caracteres (`Aa1!aaaa`), 12 caracteres,
   cada requisito faltante y confirmación distinta. No usar estos ejemplos como
   contraseñas reales.
5. Comprobar el límite con `Aa1!` más 34 letras `é` (72 bytes) y más 35 letras `é`
   (74 bytes): la segunda debe ser Baja, impedir enviar y mostrar el error sencillo.
   Enviar también entradas inválidas directamente a register/restablecer: deben
   devolver 400. Una cuenta previa debe seguir iniciando sesión con su contraseña.
6. Con dos cuentas de prueba, subir/listar/descargar/cambiar visibilidad/eliminar.
   Verificar que la segunda no accede a archivos de la primera y que la descarga
   coincide. Probar el límite de 50 MiB y fallos controlados en servicios locales.

Los cambios quedan disponibles para revisión del usuario antes de su commit y merge.
