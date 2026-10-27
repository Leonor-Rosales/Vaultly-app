# Avisos y almacenamiento del cliente

Los límites de almacenamiento y descargas se muestran en banners persistentes de tonos
crema y terracota. Las operaciones que fallan abren una ventana con el motivo y, cuando
corresponde, accesos a administrar archivos o ver planes. Las confirmaciones y los avisos
de éxito usan el mismo estilo. Los iconos de los avisos están incluidos localmente.

- Dashboard: consumo y alertas de ambos recursos.
- Mis Archivos: barra de almacenamiento, proximidad/límite y reservas en curso.
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

## Validación

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
