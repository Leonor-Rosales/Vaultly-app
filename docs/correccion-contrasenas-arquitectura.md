# Contraseñas y separación de almacenamiento

## Base y alcance

Rama de trabajo: `correccion-contrasenas-arquitectura`, creada desde
`origin/app-cliente` actualizado (base `196fe5d`). `app-clientes` no existía;
se usó `app-cliente` con autorización. El árbol estaba limpio.
No se implementaron cuotas, suscripciones, pagos ni contadores de descargas.
No se modificaron secretos, `.env`, esquema SQL ni el flujo de login.

## Cambios y archivos

- `shared/password-policy.json`: límites y expresiones comunes a ambos clientes.
- `backend/src/domain/passwordPolicy.js`: validación obligatoria reutilizada por
  `domain/validaciones.js` (registro) y `usecases/restablecerPassword.js`.
- `frontend/src/services/passwordPolicy.ts`: evaluación del indicador y confirmación;
  `components/PasswordRequirements.tsx` y `.css`: componente accesible compartido.
- `frontend/src/registro/Registro.tsx` y `recuperar/NuevaPassword.tsx`: requisitos en
  vivo, errores específicos, indicador y confirmación. Registro muestra la respuesta
  `correo_enviado` del backend y permite reenviar si falló, sin volver a crear la cuenta.
- `frontend/src/login/Login.tsx`: elimina el aviso exclusivo de Gmail. Registro
  también admite otros proveedores. La configuración del servidor SMTP se conserva.
- `backend/src/controllers/archivosRoutes.js`: transporte HTTP, multipart, identidad
  autenticada, estados, cabeceras y conexión del stream a la respuesta.
- `backend/src/usecases/archivos.js`: subir, listar, descargar, eliminar y cambiar
  visibilidad. Sus contratos de repositorio y almacenamiento están documentados en
  el módulo. No importa Express, SQL, SDK de MinIO ni adaptadores concretos.
- `backend/src/infrastructure/almacenamientoMinio.js`: adapta el cliente MinIO
  existente. `archivoRepositorio.js` conserva las consultas PostgreSQL con filtro
  por propietario. `server.js` compone e inyecta ambos adaptadores.
- `backend/test/` y `frontend/test/`: pruebas; ambos `package.json` añaden `npm test`.
- `frontend/src/planes/Planes.tsx` y `Historial.tsx`: se retiró únicamente la prop
  obsoleta `active` de `Sidebar`, que ya calcula la sección desde la URL. Era un
  error de tipos previo que bloqueaba el build; no cambia la lógica de planes.

## Política

Se cuentan caracteres como puntos de código Unicode, sin recortar, normalizar ni
cambiar mayúsculas. Se exige longitud mínima 8, minúscula, mayúscula, número ASCII
0–9 y carácter especial que no sea letra, número ni espacio. Las letras Unicode
(por ejemplo, Á y é) cuentan según su categoría. Los espacios se permiten, pero no
satisfacen el requisito de carácter especial.

`bcryptjs` mantiene hash con coste 10. Su documentación local establece el límite
de 72 bytes; se rechazan entradas mayores antes del hash, incluso si contienen
menos de 72 caracteres. Ambos lados usan los mismos límites y patrones del JSON;
las pruebas de paridad comprueban sus evaluadores. Incluir `shared/` al distribuir
el código del monolito, pues backend y frontend dependen de ese archivo.

Baja significa que falta un requisito, incluido el máximo de bytes. Media exige
todos los requisitos y 8–11 caracteres; Alta exige todos y al menos 12. El texto
del componente explica que no mide resistencia de contraseñas comunes.
La confirmación en el backend de registro sigue siendo opcional para conservar
el contrato existente; cuando se proporciona se valida. Ambas pantallas exigen
coincidencia. El contrato de restablecimiento sigue siendo `{ token, password }`.

## Separación y compatibilidad

`server → rutas/controladores HTTP → casos de uso → puertos inyectados`

Los adaptadores de PostgreSQL y MinIO implementan los puertos desde infrastructure.
La subida transforma el archivo multipart en datos del caso de uso; el adaptador
guarda el objeto y devuelve su ruta. El caso de uso guarda metadatos y compensa
eliminando el objeto si la creación de metadatos falla. Los controladores no
coordinan persistencia. El listado se filtra por usuario; descargar y eliminar
buscan por ID y propietario; la visibilidad usa una actualización filtrada por
ambos campos. Un archivo ajeno se presenta como 404 incluso si es público.

Se conservan endpoints, respuestas, descarga por streaming, cabeceras, bucket
privado y el límite técnico de subida de 50 MiB con almacenamiento en memoria.
La visibilidad es metadato: no cambia las políticas de acceso del bucket.

## Verificación

Entorno de verificación: Node 24.19.0. Para los tests TypeScript del frontend usar
Node 22.18+ o 24; no requieren instalar un runner adicional.

Desde la raíz del repositorio:

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
git diff --check
```

Se comprobaron 40 pruebas del backend y 4 del frontend: requisitos y límites de
bytes, contraseñas de 8 caracteres, paridad de evaluadores, niveles del indicador,
confirmación, rechazo en ambos casos de uso antes de persistir, hash sin alteración,
login con política anterior, resultados del correo, autorización de archivos,
limpieza y fallos parciales. La prueba HTTP usa Express y Multer reales en un
puerto efímero de loopback; simula verificación del token, repositorio y almacenamiento.
Comprueba 401, 404, multipart, listado, visibilidad, descarga, fallo del stream y borrado.
Los mensajes de error SMTP/stream impresos durante las pruebas son fallos simulados
esperados. Lint, build y comprobación de espacios del diff pasan.

No se ejecutaron PostgreSQL, MinIO ni SMTP reales, ni se accedió a producción.
La privacidad del bucket, los filtros SQL, el coste bcrypt y el límite Multer
se revisaron en código; no se verificó una subida real de 50 MiB. Las interacciones
visuales y la lectura con tecnología asistiva requieren comprobación manual.

## Prueba manual local

1. Usar únicamente configuración y cuentas de desarrollo. Instalar dependencias
   con `npm --prefix backend install` y `npm --prefix frontend install` si faltan.
2. Con Docker Desktop activo y los `.env` locales ya configurados según README,
   ejecutar `docker compose up -d`. Usar SMTP local/de pruebas para comprobar correos.
3. En terminales separadas ejecutar `npm --prefix backend run dev` y
   `npm --prefix frontend run dev`; abrir la URL que indique Vite.
4. En `/registro`, probar un correo de otro proveedor y contraseñas sintéticas:
   `abcdefghijklm` → Baja, `Aa1!aaaa` → Media, `Aa1!aaaaaaaa` → Alta. Comprobar cada
   requisito, confirmación distinta, 72 y 73 bytes, y acentos/emojis. Estos ejemplos
   son solo datos de prueba, no contraseñas recomendadas.
5. Probar el registro con SMTP operativo y caído: al fallar, la cuenta queda creada,
   se informa el fallo y aparece Reenviar verificación. Confirmar el correo cuando
   funcione y comprobar que una cuenta previa sigue pudiendo iniciar sesión.
6. Solicitar recuperación y abrir el enlace real de desarrollo en `/restablecer`.
   Repetir los casos del indicador y confirmar los mensajes de token inválido/vencido.
   Enviar también una contraseña inválida directamente a los endpoints de registro
   y restablecimiento para confirmar 400 sin depender de la UI.
7. Con dos cuentas locales, subir, listar, descargar, cambiar visibilidad y eliminar.
   La segunda cuenta no debe acceder ni modificar archivos de la primera, incluso
   al cambiar visibilidad. Verificar descarga idéntica y rechazo por encima de 50 MiB.

## Riesgos y pendientes

- Eliminar en MinIO y PostgreSQL **no es una transacción atómica**. Se mantiene el
  orden objeto → registro. Si falla MinIO, no se intenta borrar el registro. Si el
  objeto se elimina y falla PostgreSQL, queda un registro cuyo objeto falta. Un
  reintento puede completar la limpieza gracias al borrado idempotente de objetos,
  pero no existe reconciliación automática. Fallos de red con resultado desconocido
  y eliminaciones concurrentes también pueden producir respuestas de error parciales.
- Si falla la compensación de subida, puede quedar un objeto huérfano; se registra
  el error y se conserva el fallo original. Una escritura remota que termina pero
  pierde su confirmación puede igualmente dejar un resultado incierto. Pendiente:
  reconciliación o estados persistentes/outbox con reintentos, fuera del alcance actual.
- El límite de 50 MiB es por archivo y usa memoria: múltiples subidas simultáneas
  siguen consumiendo memoria. No se añadieron límites de planes.
- No se cambió el ciclo de vida de tokens de recuperación; la invalidación tras un
  uso y la revocación de sesiones existentes deben revisarse en una tarea aparte.
- Los cambios quedan sin commit, merge, push ni despliegue para revisión.
