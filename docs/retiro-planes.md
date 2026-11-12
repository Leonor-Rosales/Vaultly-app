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
