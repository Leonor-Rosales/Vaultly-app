# Comprobantes de pago

La rama `feature/propuesta` presenta comprobantes con cliente, correo, fecha y hora
en Guatemala, código, estado, método simulado, plan, capacidad, descargas, período
contratado y total en GTQ. Descargar PDF abre la impresión del navegador; la salida
usa fondo claro, oculta la aplicación y los botones y conserva toda la ficha.

## Actualización

Con la conexión local configurada en `backend/.env`, aplicar antes de reiniciar la API:

```powershell
npm --prefix backend run migrate:check
npm --prefix backend run migrate
```

`12_comprobantes_pago.sql` añade `pagos.comprobante` (JSONB nullable). Cada nueva
contratación y renovación automática guarda los datos del perfil y del plan
leídos por el servidor, junto con las mismas fechas usadas para crear la suscripción.
Se persisten dentro de la transacción que registra el pago. El monto, nombre del plan,
método, código y fecha siguen siendo las columnas históricas del pago. Los datos de
tarjeta no se envían al servidor ni se guardan.

Los cambios posteriores del perfil o catálogo no actualizan esos datos. Los pagos
anteriores mantienen NULL y muestran una explicación para los datos no registrados;
no se reconstruye el pasado con información actual ni se alteran sus importes.
Los períodos se muestran como inicio y vencimiento, usando America/Guatemala.

## Verificación

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
cd frontend
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e -- test/e2e/comprobantes.spec.ts test/e2e/cliente-configuracion.spec.ts
```

La integración usa exclusivamente `TEST_MIGRATIONS_DATABASE_URL` hacia una base local
llamada `vaultly_migraciones_test`, en un servidor de prueba separado. Crea y elimina
solo un esquema UUID propio:

```powershell
npm --prefix backend run test:comprobantes
```

Verifica migración repetida, conservación de pagos antiguos, persistencia de compras
tras editar perfil y catálogo, fechas reales de la suscripción y nuevas renovaciones.
La prueba de navegador cubre ambos temas, móvil, navegación por teclado, datos
históricos y salida de impresión/PDF.
