# Configuración, temas y cambio de correo del administrador

## Estado de entrega

Implementación desarrollada en `feature/admin-configuracion-seguridad`, desde
`origin/app-cliente` en `ad316cd3765810d7c366dd7cdcfbd8a6f629297d`.
Incluye edición del perfil, temas y cambio de correo verificado.

## Funcionalidades

- Configuración organizada en Editar perfil, Apariencia y Seguridad, adaptable a móvil.
- Nombre editable con guardado persistente; los formularios se abren bajo demanda
  y comienzan vacíos. Se solicita al navegador evitar el autocompletado.
- Validación del cambio de correo compartida en `shared/email-policy.json`: formato
  y advertencias bloqueantes para errores frecuentes como `gmail.co`. No es una
  consulta de existencia del buzón ni una lista de proveedores permitidos; otros
  dominios `.co` e institucionales son válidos. El código confirma acceso al buzón.
- Mensaje de código con HTML adaptable, colores de Vaultly, vencimiento visible,
  datos escapados y alternativa de texto simple.
- Tema claro/oscuro aplicado únicamente al panel administrativo mediante variables
  en `.admin-app`. Preferencia persistida en `vaultly:admin:tema`; sin valor guardado
  sigue `prefers-color-scheme`, incluidos cambios del sistema. Sincroniza pestañas.
- Aviso compartido `components/Aviso`: éxito, advertencia, error e información con
  la misma estructura, espaciado y bordes. Se conserva `react-hot-toast` para avisos
  transitorios, con un Toaster del administrador que hereda el tema. El cliente
  mantiene sus estilos y Toaster existentes.
- Confirmaciones mediante `<dialog>` con tema, foco inicial en Cancelar, manejo
  nativo de teclado y Escape. Sustituye los confirm del navegador en administración.
- Cambio de correo separado de la recuperación de contraseña. El correo actual
  permanece vigente hasta confirmar el código. La solicitud pendiente puede verse
  al recargar, reenviarse o cancelarse.
- Los formularios de edición de administradores conservan nombre y estado; el
  correo existente queda de solo lectura. El backend también impide cambiarlo por
  esa vía: cada titular debe verificar su dirección desde Configuración.

## Arquitectura y API

`domain/cambioCorreo` define validaciones y política; `usecases/cambioCorreo`
coordina el flujo; `infrastructure/cambioCorreoRepositorio` implementa SQL y
transacciones; `correoCambio` adapta mensajes al mailer Nodemailer existente;
`codigosCorreo` usa `crypto.randomInt` y UUID. Los componentes consumen
`services/cambioCorreo` y el cliente HTTP existente, sin consultas SQL.

Todos los endpoints exigen sesión y ADMIN activo, derivan el usuario del token y
responden con `Cache-Control: no-store`:

| Método | Ruta | Datos |
| --- | --- | --- |
| GET | `/api/admin/cambio-correo` | Estado seguro de la solicitud, sin hash ni código |
| POST | `/api/admin/cambio-correo` | `{ correo, password }`; inicia o reenvía |
| POST | `/api/admin/cambio-correo/confirmar` | `{ solicitud_id, codigo }` |
| DELETE | `/api/admin/cambio-correo` | Cancela y elimina el hash pendiente |

La contraseña actual se exige en cada envío. El frontend la limpia después de un
envío exitoso; no la guarda en almacenamiento del navegador. Los errores esperados
tienen códigos de negocio y mensajes públicos, nunca trazas SQL o SMTP.

## Política del código y concurrencia

La política se encuentra en `backend/src/domain/cambioCorreo.js`:

- Código aleatorio de seis dígitos, hash bcrypt con sal usando el adaptador existente.
- Caducidad de diez minutos y cinco intentos por código.
- Espera de sesenta segundos y máximo cinco envíos por hora por usuario.
- Cinco contraseñas incorrectas bloquean los envíos durante la ventana de quince
  minutos. Los límites se guardan en PostgreSQL y sobreviven a reinicios.
- Reenviar invalida inmediatamente el código anterior, incluso si el nuevo envío
  falla. Cancelar no reinicia la espera, el contador horario ni los fallos de contraseña.
- La solicitud vincula usuario, UUID, correo anterior y nuevo. Solo puede consumirse
  una vez. Confirmar vuelve a comprobar la disponibilidad y cambia correo/estado
  en una sola transacción. La restricción única resuelve carreras entre cuentas.

Las transacciones bloquean primero el usuario y después la solicitud. Los fallos
de código/contraseña se devuelven después del commit para conservar los contadores.
El transporte SMTP se ejecuta fuera de la transacción: primero se reserva ENVIANDO,
después se marca PENDIENTE o FALLIDO usando el mismo UUID. Una cancelación o un
reenvío concurrente no pueden reactivar un código anterior.

Si el proceso termina durante un envío, la solicitud puede quedar ENVIANDO; ese
código no se acepta. Se puede cancelar o reenviar una vez cumplida la espera.
La entrega SMTP y PostgreSQL no constituyen una transacción distribuida.

Después de confirmar se intenta enviar un aviso al correo anterior. Si falla ese
aviso, el cambio permanece confirmado y la UI presenta una advertencia explícita.
No se incluye una cola de reintentos automática para ese aviso.

## Sesión y recuperación

La identidad de sesión sigue siendo el UUID: cambiar el correo no cierra las
sesiones existentes. El middleware obtiene el rol, estado y correo actuales de la
base; no confía en el correo antiguo del JWT. El perfil visible y su copia local se
actualizan después de confirmar.

Los nuevos enlaces de recuperación incluyen el correo al que se enviaron y el
UPDATE de contraseña comprueba esa dirección de forma atómica. Los enlaces antiguos
sin ese dato solo se admiten si la cuenta nunca cambió de correo. Después del cambio,
se debe solicitar un enlace al correo actual. Se mantiene el mecanismo de logout
existente y la duración de los tokens.

## Actualizar una instalación existente

La nueva migración es `init-db/08_cambio_correo.sql`. Agrega la tabla `cambios_correo`
y la columna nullable `usuarios.correo_actualizado_en`. Conserva usuarios, planes,
suscripciones e historial; no modifica migraciones anteriores ni borra volúmenes.

Desde la raíz del repositorio, con el backend detenido y `backend/.env` configurado:

```powershell
npm --prefix backend run migrate:check
npm --prefix backend run migrate
npm --prefix backend run dev
```

En otra terminal:

```powershell
npm --prefix frontend run dev
```

Abrir Configuración con una cuenta ADMIN activa. La migración es necesaria antes
de iniciar este backend, también para el flujo de recuperación. Docker no vuelve
a ejecutar automáticamente scripts init-db sobre un volumen existente.

El envío manual usa la configuración `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`,
`MAIL_PASS` y `MAIL_FROM` ya utilizada por la aplicación. Para probar sin entregas
externas puede usarse un SMTP local de captura, como el Mailpit del entorno de
desarrollo. No se modificó el archivo `.env` ni se enviaron correos reales en pruebas.

## Pruebas

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix backend test
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix frontend run test:e2e
$env:TEST_ADMIN_DATABASE_URL='postgresql://postgres:CLAVE_DE_PRUEBA@127.0.0.1:57081/vaultly_admin_test'
npm --prefix backend run test:admin-configuracion
npm --prefix backend run test:admin
```

La integración exige una base local exclusiva `vaultly_admin_test`, crea esquemas
únicos y los conserva para inspección. Ejecuta el migrador del proyecto sobre una
base con datos previos, repite la migración y verifica preservación y concurrencia.
Las pruebas de correo usan JSON transport de Nodemailer o puertos en memoria; nunca
usan SMTP real. Las pruebas de navegador controlan las respuestas HTTP y cubren
temas, navegación, foco, avisos, validaciones, persistencia de solicitud, cancelación,
actualización del perfil y recuperación. Las suites anteriores cubren login, logout,
planes y administradores.

No se comprobó entrega SMTP real ni se ejecutó la suite completa de MinIO/cuotas.
No se aplicó la migración en la base habitual: debe hacerse al probar esta rama.

## Verificación previa a integración

- Backend: 96 pruebas aprobadas.
- Frontend: 18 pruebas aprobadas, compilación y lint correctos.
- Navegador: 13 pruebas aprobadas con Edge, escritorio y móvil.
- PostgreSQL aislado: integraciones de administración y cambio de correo aprobadas.
- Secuencia de migraciones 01–08 válida.
