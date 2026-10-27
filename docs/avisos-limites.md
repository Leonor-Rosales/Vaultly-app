# Avisos y almacenamiento del cliente

Los límites de almacenamiento y descargas se muestran en banners persistentes de tonos
crema y terracota. Las operaciones que fallan abren una ventana con el motivo y, cuando
corresponde, accesos a administrar archivos o ver planes. Las confirmaciones y los avisos
de éxito usan el mismo estilo. Los iconos de los avisos están incluidos localmente.

- Dashboard: consumo y alertas de ambos recursos.
- Mis Archivos: avisos de proximidad/límite y reservas en curso, sin barra permanente.
- Biblioteca: descargas próximas a agotarse o agotadas, fecha de renovación y acceso a planes.
- Operaciones: errores de carga, descarga, eliminación, visibilidad, etiquetas y contratación.
- Carga parcial: resumen de los fallidos y reintento únicamente de los pendientes.
- Eliminación: confirmación antes de borrar; Escape y Cancelar conservan el archivo.

La barra calcula el porcentaje a partir de `usados_bytes / cuota_bytes`. Con archivos muy
pequeños muestra una marca de 4 px y el porcentaje real (`< 0.1%` cuando corresponde),
sin presentar un uso ficticio. Cero bytes mantiene la barra vacía; sobrecuota llena la barra
hasta 100% y conserva el porcentaje real en el texto. Las reservas se indican por separado.

Después de cargar, eliminar o descargar se actualiza el consumo. Si la consulta falla,
se conserva el último valor conocido con un aviso para reintentar. Los límites continúan
siendo verificados por el backend; los mensajes del cliente no sustituyen esa validación.

## Tamaño de archivo

La ruta activa `POST /api/archivos` y el cliente comparten el límite de
`shared/upload-policy.json`: 1.073.741.824 bytes (1 GiB, mostrado como «1 GB»).
El límite es inclusivo y por archivo; también debe haber espacio disponible en el plan.
Un exceso devuelve HTTP 413 con código `ARCHIVO_DEMASIADO_GRANDE`.

El backend recibe en el directorio temporal del sistema y transmite a MinIO mediante
un stream, sin mantener todo el archivo en RAM. Los temporales se eliminan al terminar
o rechazar la carga. Debe haber espacio libre para las cargas simultáneas; una terminación
forzada del proceso puede dejar temporales `vaultly-upload-*` para limpieza operativa.
El tiempo máximo de recepción del servidor es de 30 minutos. Si se usa un proxy,
sus límites de cuerpo y tiempo deben permitir también estas cargas y el envoltorio multipart.

Para actualizar, descargar esta rama y reiniciar el backend; reconstruir/publicar el frontend
con `npm --prefix frontend run build`. No requiere migraciones. Conservar la carpeta `shared`
junto a `backend` al desplegar. El controlador antiguo `subidaController.js` no está conectado
al servidor: `MAX_SUBIDA_BYTES` no configura esta ruta activa.

La prueba HTTP real del límite escribe aproximadamente 2 GiB en temporales secuenciales
y verifica aceptación exacta, rechazo por un byte y limpieza, usando almacenamiento simulado:

```powershell
npm --prefix backend run test:upload-large
```

## Chequeos del frontend

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend test
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix frontend run test:e2e
```

La suite de navegador utiliza respuestas HTTP controladas para probar carga/eliminación,
cuotas, archivos pequeños, errores de red, cargas parciales, reintento, reservas y rutas
protegidas. No modifica cuentas ni archivos reales. Las capturas de escritorio y móvil
quedan en `frontend/test-results/`, excluido de Git.
