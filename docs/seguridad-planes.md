# Seguridad de planes

## Actualización

Aplicar `13_seguridad_planes.sql` con el migrador antes de iniciar la API nueva;
actualizar backend y frontend juntos:

```powershell
npm --prefix backend run migrate:check
npm --prefix backend run migrate
npm --prefix frontend run build
```

La migración añade `planes.version`, su trigger y los tipos de acción para la tabla
`auditoria` existente. No modifica precios, beneficios, pagos ni suscripciones.

## Cambios

- El catálogo y las consultas administrativas devuelven `version` (entero).
  El trigger la incrementa cuando cambian nombre, precio, capacidad, descargas,
  permiso de carpetas públicas o estado. Incluso una edición directa por SQL la cambia.
- `PUT /api/admin/planes/:id` exige la versión consultada. La comprobación se hace
  dentro de la transacción y el UPDATE incluye la versión. Un formulario antiguo
  recibe 409 `PLAN_DESACTUALIZADO`, conserva sus campos y ofrece **Recargar plan**.
  El cambio de estado desde el listado ofrece **Actualizar planes** ante el conflicto.
- `POST /api/planes/contratar` exige `versionPlan`. La versión y disponibilidad se
  comprueban antes de crear suscripción o pago. El plan se bloquea para lectura
  hasta terminar la transacción. Los datos de precio y beneficios siguen saliendo
  del servidor, no del cliente. Una versión ausente o antigua no puede comprar.
- Ante un conflicto, el cliente reutiliza `Aviso` con variante `advertencia`,
  bloquea Confirmar Pago y ofrece **Actualizar resumen del plan**. Actualizar el
  resumen no compra: el usuario debe revisar las condiciones y confirmar otra vez.
  Si falla la actualización, el pago sigue bloqueado. Un plan retirado conduce
  nuevamente al catálogo. No se reintenta una compra automáticamente.
- La auditoría usa `PLAN_CREADO`, `PLAN_EDITADO`, `PLAN_ACTIVADO` y
  `PLAN_DESACTIVADO`. Incluye responsable, fecha, ID del plan y fotos anterior/nueva
  con los campos del catálogo y sus versiones. No guarda tokens ni tarjetas.
  Plan y auditoría se confirman o revierten juntos. Los rechazos no producen
  registros falsos de cambios exitosos. No se añade una pantalla de auditoría.
- Solo el plan canónico `Free` admite precio cero y debe continuar activo.
  Los nombres equivalentes como `FREE` no permiten eludir la reserva. El servidor
  rechaza crear planes adicionales de precio cero y el formulario requiere precio
  positivo. Un plan gratuito antiguo ajeno a Free puede retirarse manteniendo sus
  condiciones, para no impedir la limpieza de catálogos existentes.

Las condiciones de un plan con suscripciones siguen protegidas. La versión es
control de concurrencia del catálogo, no una modificación de esa regla de negocio.
Los avisos y confirmaciones usan las plantillas existentes.

## Pruebas

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run lint
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix frontend run test:e2e -- test/e2e/seguridad-planes.spec.ts test/e2e/admin.spec.ts test/e2e/admin-configuracion.spec.ts test/e2e/comprobantes.spec.ts
```

Para PostgreSQL usar exclusivamente un servidor local de pruebas separado, con una
base llamada `vaultly_migraciones_test` en `TEST_MIGRATIONS_DATABASE_URL`:

```powershell
npm --prefix backend run test:seguridad-planes
npm --prefix backend run test:comprobantes
```

La integración crea un esquema UUID propio y lo elimina al terminar. Comprueba
dos guardados concurrentes, rechazo de versiones antiguas/ausentes, conservación
de suscripciones ante un rechazo, monto determinado por el servidor, eventos de
auditoría, reversión ante fallos de auditoría y versionado ante SQL directo.
