# Promociones y auditoría administrativa

## Tipos de promoción (migración 15)

El selector **Tipo de promoción** permite **Porcentaje de descuento**, **Precio
promocional fijo** o **Período gratis**. Solo se aplica un tipo por plan; no se
acumulan descuentos. El formulario muestra el precio final del primer período.

En porcentaje se admiten valores mayores a 0 y hasta 100, con dos decimales.
Ejemplo: Q200 con 25 % de descuento queda en Q150. El servidor calcula en centavos
y PostgreSQL vuelve a calcularlo en un trigger. El precio final enviado por un
cliente no puede alterar ese resultado. Un descuento que no reduzca al menos un
centavo se rechaza. Gratis fija Q0; precio fijo conserva el importe elegido.

Aplicar `15_tipos_promociones.sql` con el migrador. Las ofertas anteriores se
conservan: un importe Q0 se clasifica como gratis y los demás como precio fijo.
Se guardan `promocion_tipo`, `promocion_porcentaje` y el precio resultante. Cambiar
el tipo o el porcentaje incrementa la versión del plan y queda en auditoría.
El comprobante guarda el tipo y porcentaje originales de la compra, aunque el
administrador cambie la oferta posteriormente. Las reglas de fechas, primer
período y renovación al precio habitual descritas abajo siguen siendo las mismas.

## Actualizar

Aplicar `14_promociones_auditoria.sql` antes de reiniciar el backend y reconstruir
el frontend. Se añade precio promocional, inicio y fin; se extiende el trigger de
versión del plan y se registran los tipos de acción de gestión de administradores.
Los precios normales, suscripciones y pagos existentes permanecen iguales.

```powershell
npm --prefix backend run migrate:check
npm --prefix backend run migrate
npm --prefix frontend run build
```

## Una promoción de Max a Q0

En Crear/Editar plan, conservar el **Precio mensual** habitual (por ejemplo Q200).
Activar **Promoción temporal**, escribir **Precio promocional Q0** y elegir inicio
y fin. Las fechas del formulario están expresadas en Guatemala (UTC-06:00),
independientemente de la zona configurada en la computadora.

La promoción se aplica a nuevas contrataciones dentro de `[inicio, fin)`, usando
el reloj de PostgreSQL. Cada contratación obtiene un período mensual completo
desde su activación. Terminar o modificar la oferta no recorta períodos adquiridos
ni modifica sus comprobantes. La promoción no altera los límites del plan.

Las renovaciones automáticas usan el precio habitual del plan, incluso si hay otra
campaña activa. La casilla empieza desactivada y muestra el precio de renovación;
si el cliente no acepta renovar, vuelve a Free al vencer. La activación a Q0 no
pide tarjeta. Se registra un movimiento simulado por Q0 con comprobante y el
consentimiento de renovación. Ninguna tarjeta se envía al servidor.

Los datos de promoción en la API son `promocion_precio`, `promocion_inicio` y
`promocion_fin`; para retirar una oferta se envían los tres como NULL. Omitirlos
al editar conserva su valor anterior. Precio promocional menor al habitual,
fechas completas y orden correcto se validan en backend y PostgreSQL. Free no
admite promoción. La protección de precio habitual y beneficios de planes con
suscriptores continúa vigente; la campaña se puede ajustar sin alterar esos datos.

El catálogo entrega `precio_vigente` y `promocion_vigente`. Contratar envía
`versionPlan` y `precioConfirmado`: el servidor verifica versión y precio antes
de crear pago/suscripción. Así también detecta que una oferta acaba de comenzar
o vencer, aunque no se haya editado el plan y la versión permanezca igual.
Actualizar un resumen nunca ejecuta una compra automáticamente.

## Auditoría

El menú administrativo incluye `/admin/auditoria`. Ofrece búsqueda por responsable
o nombre del registro, filtro de acción, paginación de 25 eventos y detalle con
valores anteriores y nuevos. Fechas y horas se muestran en Guatemala.

`GET /api/admin/auditoria?pagina=1&accion=PLAN_EDITADO&q=Max` usa la misma protección
de administrador activo que el resto del panel. Las consultas usan parámetros y
los filtros tienen validación de tipo y longitud. No hay rutas para editar o borrar
la auditoría.

Se muestran los eventos de planes ya registrados y los eventos nuevos de alta,
edición, activación y desactivación desde la gestión de administradores. El registro
se confirma en la misma transacción que la operación. Las fotos de cuentas solo
incluyen ID, nombre, correo y estado; nunca hashes, contraseñas o tokens. El historial
no reconstruye operaciones antiguas que no se registraron y no cubre cambios de
perfil personal o recuperación de contraseñas.

## Pruebas

```powershell
npm --prefix backend test
npm --prefix frontend test
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix frontend run test:e2e -- test/e2e/promociones-auditoria.spec.ts test/e2e/seguridad-planes.spec.ts test/e2e/admin.spec.ts
```

En PostgreSQL local aislado, con `TEST_MIGRATIONS_DATABASE_URL` hacia la base
exclusiva `vaultly_migraciones_test`, ejecutar `npm --prefix backend run test:promociones`.
La integración comprueba conservación del período después de terminar la oferta,
renovación habitual con consentimiento, regreso a Free sin consentimiento,
reconfirmación al vencer una oferta y auditoría sin contraseñas/hashes.
