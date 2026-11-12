# Retiro automático de planes inactivos

La regla utiliza 30 días completos (720 horas) consecutivos desde la desactivación.
El backend revisa al arrancar y cada hora, hasta 100 planes elegibles por ejecución.
Si el backend estuvo detenido, procesa los vencidos al arrancar nuevamente.

- Sin ninguna suscripción ni pago: se elimina el registro del plan.
- Con historial: se marca `archivado_en` y se oculta del listado administrativo.
  Las suscripciones, pagos, comprobantes y el plan conservado no se borran.
- Con una suscripción ACTIVA o PENDIENTE cuya fecha de fin aún no pasó: se espera.
- Reactivar antes del retiro cancela la fecha; desactivar otra vez inicia 30 días nuevos.
- Free queda protegido. Un formulario abierto no puede reactivar un plan ya archivado.

El menú Auditoría muestra **Plan retirado del listado** o **Plan eliminado sin uso**,
con responsable **Sistema automático**, fecha y foto del plan anterior. Los eventos
se guardan en la misma transacción de retiro; si fallan, se revierte la operación.
Se puede buscar el nombre de un plan incluso después de eliminarlo.

La pantalla de planes muestra la política, la fecha a partir de la cual procede el
retiro y si debe esperar a suscripciones vigentes. La confirmación de desactivación
reutiliza el diálogo existente y explica la limpieza automática.

## Actualización

```powershell
npm --prefix backend run migrate:check
npm --prefix backend run migrate
```

`16_retiro_planes.sql` añade `inactivo_desde`, `archivado_en`, índices y tipos de
auditoría. El trigger guarda la primera desactivación y reinicia el contador al
reactivar. Los planes que ya estaban inactivos empiezan su plazo al aplicar esta
migración: no se inventa una fecha pasada ni se retiran inmediatamente.
La migración no ejecuta la limpieza ni elimina datos. Reiniciar el backend después.

La limpieza usa el reloj de PostgreSQL y coordina con compras/ediciones usando el
mismo orden de bloqueos. Un bloqueo asesor transaccional evita dobles limpiezas
entre instancias. No hay una ruta pública para adelantar el reloj o disparar el borrado.
Los errores se registran y el siguiente ciclo reintenta sin confirmar cambios parciales.

## Correo a los clientes afectados

Al confirmar la desactivación de un plan, se preparan en la misma transacción
los avisos de sus suscripciones activas o pendientes que aún no hayan vencido,
con o sin renovación automática. La tabla `correos_retiro_planes` (migración 17)
evita duplicados por evento y cliente. Un fallo de auditoría o de preparación
del correo revierte toda la desactivación.

El backend procesa hasta 20 avisos al arrancar y cada minuto. Usa el transporte
SMTP ya configurado y comparte la plantilla del correo de cambio de dirección.
Incluye el plan, vencimiento en Guatemala, conservación de beneficios hasta esa
fecha, paso a Free sin otro cobro si sigue desactivado y enlace al catálogo.
No cambia las preferencias de renovación. No hay preferencias de correo
configurables actualmente: este aviso es sobre la suscripción, no publicidad.

Los fallos de transporte se reintentan con esperas de 1 minuto hasta un máximo
de 1 hora. Antes de enviar se consulta el correo actual del cliente y se cancela
el aviso si el plan fue reactivado o la suscripción dejó de estar vigente.
Los bloqueos por fila evitan que dos procesos envíen el mismo pendiente a la vez.
Si SMTP acepta el mensaje y el proceso cae antes de confirmar la base, podría
repetirse el envío; se conserva el mismo Message-ID para esos reintentos.
No se generan avisos retroactivos de desactivaciones anteriores a la migración.

El formulario administrativo identifica los planes con contrataciones y deshabilita
nombre, precio, almacenamiento, descargas y carpetas públicas. Las promociones y
el estado siguen disponibles; el servidor conserva su validación independiente.

## Avisos informativos

La explicación del retiro de planes y la del primer período promocional incluyen
una X para cerrarlas. Se reutiliza la plantilla `Aviso` con el componente
`AvisoInformativo`. El cierre se recuerda por cuenta y por aviso en el navegador
(`localStorage`), incluso al volver a iniciar sesión. Si cambia el texto, vuelve
a mostrarse. Otro navegador o borrar sus datos también hará que aparezca.
Si el almacenamiento está bloqueado, se cierra únicamente en la vista actual.
Los errores, conflictos y advertencias importantes conservan su comportamiento.

## Pruebas

```powershell
npm --prefix backend test
npm --prefix frontend run build
```

En un PostgreSQL local separado, con `TEST_MIGRATIONS_DATABASE_URL` hacia la base
exclusiva `vaultly_migraciones_test`:

```powershell
npm --prefix backend run test:retiro-planes
```

La prueba crea y elimina su propio esquema UUID. Verifica el límite exacto de 30 días,
reactivación, planes previamente inactivos, referencias a pagos/suscripciones,
concurrencia, auditoría, reversión ante fallos y protección de Free. No toca datos
de la aplicación. El proceso temporal usado por la prueba no es el backend normal.
