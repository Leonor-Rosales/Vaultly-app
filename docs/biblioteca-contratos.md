# Biblioteca Pública: entrega del frontend

Rama: `feature/biblioteca-ui-filtros`, creada desde `origin/app-cliente` actualizado. El árbol inicial estaba limpio. Sin commit, push, merge ni despliegue automáticos. No se modificaron backend, SQL, migraciones, infraestructura ni datos.

## Pantalla y estructura

Ruta `/biblioteca`, conectada al enlace existente del Sidebar. Se reutilizan el usuario de sesión, su nombre/iniciales y el plan obtenido por `useConsumo`; nunca se reemplazan por el usuario del mockup. En móvil hay un botón para desplegar el mismo Sidebar.

- `frontend/src/biblioteca/tipos.ts`: tipos públicos y opciones de tipo/orden.
- `estado.ts`: URL, limpieza, reinicio de página, rangos, categorías y protección contra respuestas tardías.
- `useBiblioteca.ts`: estado de resultados, debounce de 300 ms, cancelación, errores y reintento.
- `http.ts`: adaptador HTTP autenticado y validación de la forma de las respuestas.
- `demo.ts`: adaptador de demostración con 18 archivos, búsqueda/filtros/orden/páginas y opciones.
- `servicio.ts`: elección explícita del adaptador.
- `Biblioteca.tsx`, `Filtros.tsx`, `TarjetaArchivo.tsx`, `Biblioteca.css`: presentación y estados visuales.
- `frontend/src/App.tsx`: nueva ruta. No se modifican otras pantallas.
- `frontend/test/biblioteca.test.mjs`: pruebas de lógica, contrato y concurrencia.
- `frontend/test/etiquetas.test.mjs`: actualización del doble de hooks del control existente; la prueba estaba desactualizada respecto al botón +. Conserva sus aserciones y comprueba que + abre el editor.

No hay dependencias nuevas. No se muestran cifras acumuladas de descargas: el backend actual no proporciona una fuente con significado definido.

## Endpoints existentes y compatibilidad

- `GET /api/archivos/publicos` devuelve un array sin paginación, con `usuario_id` pero sin el nombre público de autor. **No se modifica ni se reutiliza silenciosamente como la nueva respuesta paginada**.
- `GET /api/archivos/:id/descargar` sigue siendo el endpoint de descarga. El cliente reutiliza `descargarArchivo`, incluido su manejo de errores y actualización del consumo. El backend decide permisos y cuotas: descargar un archivo propio no consume; uno público ajeno sí.
- Los tres endpoints `/api/biblioteca/*` de este documento **son una propuesta pendiente de implementación**. En modo HTTP un 404 o error se presenta como error, nunca activa datos ficticios.

## Reglas comunes

Base: `VITE_API_URL`, por defecto `http://localhost:3000`. Autenticación: `Authorization: Bearer <token>` usando la sesión actual. Respuestas JSON UTF-8. No devolver correos, rutas MinIO, nombres de objetos internos ni archivos privados.

Errores no exitosos, por ejemplo 400, 401 o 500:

```json
{"error":"El parámetro pagina debe ser un entero positivo","codigo":"PARAMETRO_INVALIDO"}
```

`error` debe ser un texto público claro; `codigo` es opcional. El cliente muestra `error`, no detalles internos. Respuestas mal formadas se presentan como error de integración. El frontend envía AbortSignal y descarta respuestas antiguas incluso si el transporte no respeta la cancelación.

## GET /api/biblioteca/archivos

| Parámetro | Tipo y comportamiento |
|---|---|
| `q` | Texto opcional; coincidencia parcial en nombre de archivo, etiquetas o nombre público de autor. Espacios extremos ignorados. |
| `tipo` | Opcional: `documentos`, `imagenes`, `videos`, `audio`, `comprimidos`, `otros`. Ausencia = todos. |
| `etiqueta_id` | Entero positivo repetible. Deduplicar IDs. Entre estos valores se aplica OR. |
| `autor_id` | UUID opcional de un único autor. El texto escrito en el buscador de opciones NO selecciona autor. |
| `orden` | `recientes` (predeterminado), `antiguos`, `nombre_asc`, `tamanio_desc`, `tamanio_asc`. |
| `pagina` | Entero positivo, predeterminado 1. |
| `por_pagina` | Entero 12; esta versión del cliente siempre solicita 12. |

Ejemplo (conjunción de texto, tipo, autor y cualquiera de las dos etiquetas):

```http
GET /api/biblioteca/archivos?q=matematicas&tipo=documentos&etiqueta_id=1&etiqueta_id=2&autor_id=00000000-0000-4000-8000-000000000001&orden=recientes&pagina=1&por_pagina=12
Authorization: Bearer <token>
```

```json
{
  "items": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "nombre_original": "Resumen.pdf",
      "tamanio_bytes": "1250000",
      "tipo_mime": "application/pdf",
      "created_at": "2026-10-14T12:00:00.000Z",
      "autor": {
        "id": "00000000-0000-4000-8000-000000000001",
        "nombre_completo": "Nombre público"
      },
      "etiquetas": [{"id": 1, "nombre": "matemáticas"}]
    }
  ],
  "total": 1,
  "pagina": 1,
  "por_pagina": 12
}
```

`tamanio_bytes` conserva BIGINT como string decimal no negativo. `total`, `pagina`, `por_pagina` e IDs de etiquetas son números JSON; IDs de archivos y autores son strings UUID. Las etiquetas ausentes se representan con `[]`. `total` cuenta todo el conjunto filtrado, no solo la página. Una página fuera de rango devuelve `items: []`, conserva el total y devuelve la página solicitada; la UI ofrece volver a la primera página. Cero resultados: `items: []`, `total: 0`, nunca 404.

Aplicar **AND** entre q/tipo/autor/grupo de etiquetas; **OR** dentro del grupo de etiquetas. Buscar sin distinguir mayúsculas ni acentos, conservando los nombres originales (no renombrar las etiquetas persistidas). Para la demostración se usan NFD, eliminación de marcas y minúsculas.

Filtrar antes de paginar; contar archivos distintos sin duplicarlos por sus relaciones. Ordenar antes de paginar:

- recientes: `created_at DESC, id ASC`;
- antiguos: `created_at ASC, id ASC`;
- nombre_asc: nombre en orden alfabético español sin distinguir mayúsculas/acentos, `id ASC`;
- tamanio_desc/asc: tamaño numérico en el sentido solicitado, `id ASC`.

Clasificación propuesta para alinear backend y demo, por prioridad:

1. `image/*`, `video/*`, `audio/*` → categoría correspondiente.
2. MIME que contenga zip/compressed/archive/gzip/tar o extensiones zip/rar/7z/tar/gz → comprimidos.
3. MIME que contenga pdf/word/officedocument/opendocument/rtf o extensiones txt/csv/xls/xlsx/ppt/pptx/doc/docx → documentos.
4. Resto → otros, incluido código fuente. La tarjeta muestra icono de código para ts/js/html/css/py/json.

## Opciones públicas

```http
GET /api/biblioteca/etiquetas?q=matematicas&limite=20
GET /api/biblioteca/autores?q=perez&limite=20
```

Respuestas:

```json
{"items":[{"id":1,"nombre":"matemáticas"}]}
```

```json
{"items":[{"id":"00000000-0000-4000-8000-000000000001","nombre_completo":"Fernando Pérez"}]}
```

`q` es opcional, parcial y sin distinguir mayúsculas/acentos. `limite` positivo, máximo 20 para esta integración. Sin coincidencias: `items: []`. Opciones únicas, ordenadas por nombre y desempate por ID. Obtenerlas exclusivamente de relaciones con archivos públicos; no de todos los usuarios o todas las etiquetas globales. Son opciones globales públicas y no dependen de los otros filtros activos.

## Estado de navegación

Búsqueda, tipo, IDs de etiquetas, autor, orden y página se guardan en la URL con los mismos nombres de parámetros. El tamaño de página se fija en 12. Al escribir se usa `replace` y se espera 300 ms antes de consultar; no se crea historial por tecla. Cambios de filtros/orden/página crean historial para Atrás/Adelante. Cualquier cambio de búsqueda/filtros/orden vuelve a la página 1. “Borrar texto” conserva los demás filtros. “Limpiar todo” conserva el orden y vuelve a la página 1.

Los textos locales para buscar opciones no se guardan como filtros. Tras recargar, si una selección por ID no está entre las primeras 20 opciones, se muestra “Autor seleccionado” o “Etiqueta seleccionada” hasta que su nombre esté disponible; el filtro por ID se conserva y se puede quitar. Una futura mejora sería un endpoint de resolución de IDs seleccionados.

## Ejecutar demostración

Desde la raíz del repositorio, PowerShell:

```powershell
$env:VITE_BIBLIOTECA_MOCK='true'
npm --prefix frontend run dev
```

Abrir `/biblioteca` en el puerto indicado por Vite. Para ver el perfil/plan reales, usar el mismo origen y sesión en que se inició sesión en Vaultly; la demostración no inventa datos del usuario. La lista muestra “Datos de demostración”; todos sus botones de descarga están deshabilitados con “Requiere integración”. Hay 18 archivos, suficientes para dos páginas y las seis categorías.

Para volver al adaptador HTTP, detener Vite y reiniciarlo:

```powershell
$env:VITE_BIBLIOTECA_MOCK='false'
npm --prefix frontend run dev
```

También puede configurarse `VITE_BIBLIOTECA_MOCK=true` en `frontend/.env.local` (no versionarlo); eliminarlo o cambiarlo a false para desactivar. Es una variable de Vite evaluada al iniciar/build: reiniciar o reconstruir al cambiarla. No modificar el `.env` del backend. Una variable de entorno de PowerShell tiene precedencia sobre el archivo.

## Pendientes de backend

1. Crear los tres endpoints autenticados sin alterar `/api/archivos/publicos`.
2. Validar parámetros, enums, UUID, límites, página e IDs; errores JSON sin filtrar información interna.
3. Aplicar búsqueda, AND/OR, clasificación, orden estable, conteo distinto y paginación en servidor.
4. Incluir autor público y etiquetas en cada resultado sin consultas por archivo.
5. Garantizar aislamiento de privados y opciones exclusivamente públicas.
6. Conservar descarga y cuotas actuales; no añadir contadores ficticios.
7. Verificar la integración HTTP real y las carreras concurrentes de visibilidad/datos.

## Verificación

Pruebas frontend: 17/17. Lint sin incidencias y build TypeScript/Vite correcto. Incluye pruebas nuevas de AND/OR, limpieza, reinicio de página, total/rangos, coincidencias, errores HTTP, serialización, datos públicos y respuestas fuera de orden. HTTP se prueba con transporte sustituido; la demostración usa datos locales. No se consultaron nuevos endpoints reales ni se ejecutaron migraciones.

La revisión visual en navegador no pudo completarse: el navegador integrado rechazó la pestaña por no pertenecer a la sesión y su inventario quedó vacío. Escritorio y móvil están revisados en código, pendientes de verificación visual. Probar búsqueda rápida, limpiar texto, combinar filtros, Escape/Tab, dos páginas, recarga/Atrás/Adelante y ancho móvil. En HTTP, comprobar carga fallida/reintento hasta que se implementen los endpoints.
