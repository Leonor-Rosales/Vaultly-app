# Configuración compartida de cliente y administrador

## Estado de la entrega

Implementación local en `feature/cliente-configuracion`, creada desde
`origin/app-cliente` en `5aa9828db607778ac932085b3fd5ea817e2e4111`.
El usuario autorizó el commit y push únicamente a esta rama. PR y merge quedan
pendientes de autorización.

## Funcionalidades y código compartido

- `/configuracion`: ruta de cliente autenticado, enlazada desde la navegación existente.
- Perfil con nombre, correo y rol real. El nombre se guarda y actualiza inmediatamente
  en el perfil, la barra lateral y los comprobantes de pago.
- Cambio de correo con contraseña actual, código, reenvío, cancelación y notificación
  al correo anterior. Se conserva toda la política y la tabla existentes.
- Recuperación de contraseña mediante el flujo existente.
- Tema claro/oscuro en todas las pantallas del cliente, navegación, formularios,
  tablas, carga de archivos, comprobantes y avisos. Menú móvil compartido del cliente.

`frontend/src/cuenta/Configuracion.tsx` y `CambioCorreo.tsx` reciben `usuario`,
`actualizar` y `ambito`. No dependen del contexto, servicios ni CSS de administración.
`admin/Configuracion.tsx` es solamente un adaptador al layout administrativo.

`cuenta/tema.ts` comparte la suscripción a sistema/storage y la persistencia con dos
claves: `vaultly:admin:tema` (conservada) y `vaultly:cliente:tema`. `Tema.css` contiene
la paleta común; cada layout limita las variables a su propio contenedor. Las páginas
públicas no reciben esas variables. Los comprobantes en un portal llevan su propio
contenedor temático; la impresión conserva colores claros.

`cuenta/avisos.tsx` utiliza el componente `Aviso` existente para ambos roles, con
Toaster e identificadores independientes. Solo se monta el Toaster correspondiente
a la zona visible. Los avisos de archivos, consumo y planes usan las mismas variantes.

`services/cuenta.ts` guarda el nombre; `services/cambioCorreo.ts` usa los endpoints
compartidos. El contexto del cliente conserva el perfil verificado en memoria y
actualiza su copia local; no confía en localStorage para decidir permisos.

## Ajustes visuales del cliente

La paleta clara recupera los tonos crema, bordes durazno y acentos naranja de los
mockups. Dashboard muestra plan, almacenamiento, descargas usadas/límite con su fecha de renovación y total de
archivos públicos y privados. Biblioteca conserva búsqueda, filtros y orden, con
la acción Todos y hasta cuatro columnas en pantallas amplias. Los datos de ejemplo
para las capturas existen únicamente en las pruebas de navegador.

Los avisos del cliente recuperan el diseño crema y durazno de las referencias:
banners persistentes de almacenamiento próximo al límite, lleno o reservado y
descargas próximas al límite o agotadas. Dashboard reúne ambos tipos; Mis Archivos
muestra almacenamiento y Biblioteca muestra descargas. Los fallos al consultar
consumo conservan el último dato conocido y ofrecen Reintentar.

Los diálogos cubren espacio insuficiente/lleno (con barra y enlaces a archivos y
planes), cuota de descargas agotada (con renovación), errores de carga/descarga,
fallos de red, cargas parciales y confirmación de eliminación. Las cargas parciales
reintentan únicamente archivos fallidos. Los mensajes breves de éxito, información,
advertencia y error comparten la paleta del cliente, incluidos los de configuración.
Los diálogos admiten teclado, Escape, restauración del foco y tema oscuro.

## API y permisos

| Método | Ruta | Comportamiento |
| --- | --- | --- |
| PATCH | `/api/cuenta/perfil` | Solo `{ nombre_completo }`, máximo 150 caracteres |
| GET | `/api/cuenta/cambio-correo` | Solicitud del titular autenticado |
| POST | `/api/cuenta/cambio-correo` | Solicita/reenvía con `{ correo, password }` |
| POST | `/api/cuenta/cambio-correo/confirmar` | Confirma `{ solicitud_id, codigo }` |
| DELETE | `/api/cuenta/cambio-correo` | Cancela la solicitud propia |

Los campos adicionales del perfil se rechazan con 400. No se acepta un identificador
arbitrario: la identidad proviene de `req.usuario.sub`. El UPDATE permite únicamente
el nombre y vuelve a exigir estado ACTIVO y rol CLIENTE/ADMIN. No modifica correo,
rol, estado, plan ni cuotas.

Los endpoints `/api/admin/cambio-correo` siguen existiendo, restringidos a ADMIN,
con los mismos casos de uso. Las rutas de gestión administrativa no cambian sus
permisos. El repositorio de correo ahora admite ambos roles activos y la confirmación
responde con el rol real leído bajo bloqueo de la cuenta.

No se añadieron tablas ni se modificaron migraciones históricas. Se necesita tener
aplicada la migración 08 incluida previamente en `app-cliente`.

## Validación

- Build y lint del frontend.
- 100 pruebas de backend: permisos, campos adicionales, titularidad, errores,
  códigos incorrectos/vencidos/usados, límites, SMTP simulado y rol real.
- 18 pruebas del frontend.
- 29 pruebas de navegador con Edge: administrador y cliente, móvil/escritorio,
  nombre, correo, recuperación, temas, navegación, archivos y cierre de sesión.
- 3 integraciones PostgreSQL en `vaultly_admin_test`: migración/preservación,
  concurrencia del correo y administración, perfil de cliente y cuenta bloqueada.
- `migrate:check` y `git diff --check`.

Las pruebas de navegador simulan las respuestas HTTP. Las integraciones usan una
base local aislada y esquemas exclusivos; los transportes de correo son simulados.
No se enviaron correos reales, no se alteró la base habitual y no se ejecutó la suite
completa de almacenamiento MinIO/cuotas ni una prueba de impresión física.

## Probar localmente

1. Usar una instalación de desarrollo con las migraciones 01–08 aplicadas y correo
   de captura local (por ejemplo Mailpit). No usar credenciales de SMTP real para
   las pruebas automatizadas. Si hace falta migrar una instalación, detener primero
   el backend y usar `npm --prefix backend run migrate` con su base de desarrollo.
2. Desde la raíz del repositorio, iniciar backend y frontend en terminales separadas:

   ```powershell
   npm --prefix backend run dev
   npm --prefix frontend run dev
   ```

3. Iniciar sesión con CLIENTE activo y abrir `/configuracion`. Editar el nombre,
   recargar, cambiar el tema y navegar por Dashboard, Archivos, Biblioteca y Planes.
   Solicitar el código a una dirección de prueba, tomarlo del buzón local y confirmar.
4. Cerrar sesión e iniciar como ADMIN activo. Abrir `/admin/configuracion` y repetir
   las operaciones; comprobar que el tema administrativo anterior se conserva.
5. Para ejecutar las comprobaciones automáticas:

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
