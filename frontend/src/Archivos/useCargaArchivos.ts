import { useState } from 'react';
import { incluirPendiente } from '../../../shared/etiquetas.mjs';
import { subirArchivo, type Archivo } from '../services/archivos';
import { avisosCliente as toast } from '../cuenta/avisos';
import { useAvisos } from '../components/contextoAvisos';

type ArchivoPendiente = {
  id: string;
  file: File;
  estado: "pendiente" | "subiendo" | "completado" | "error";
  error?: string;
};

type OpcionesCargaArchivos = {
  onClose: () => void;
  onUploaded: (archivo: Archivo) => void | Promise<void>;
};

// Coordina la cola de carga y sus resultados; la vista conserva el marcado y los estilos.
export function useCargaArchivos({ onClose, onUploaded }: OpcionesCargaArchivos) {
  const { avisar, avisarError } = useAvisos();
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [pendienteEtiqueta, setPendienteEtiqueta] = useState('');
  const [errorEtiquetas, setErrorEtiquetas] = useState('');

  const [pendientes, setPendientes] = useState<ArchivoPendiente[]>([]);
  const [visibilidad, setVisibilidad] = useState<"privado" | "publico">(
    "privado"
  );
  const [subiendo, setSubiendo] = useState(false);

  const agregarPendientes = (seleccionados: File[]) => {
    if (seleccionados.length === 0) return;

    setPendientes((actuales) => {
      const nuevos = seleccionados
        .filter(
          (file) =>
            !actuales.some(
              (item) =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified
            )
        )
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          estado: "pendiente" as const,
        }));

      return [...actuales, ...nuevos];
    });
  };

  const quitarPendiente = (id: string) => {
    setPendientes((actuales) =>
      actuales.filter((item) => item.id !== id)
    );
  };

  const cerrarModal = () => {
    if (subiendo) return;
    onClose();
  };

  const cargarPendientes = async () => {
    const porSubir = pendientes.filter(
      (item) =>
        item.estado === "pendiente" || item.estado === "error"
    );

    if (porSubir.length === 0) {
      avisar({ titulo: 'Selecciona tus archivos', mensaje: 'Añade al menos un archivo para comenzar la carga.' });
      return;
    }

    let etiquetasCarga: string[];
    try {
      etiquetasCarga = incluirPendiente(etiquetas, pendienteEtiqueta);
      setEtiquetas(etiquetasCarga); setPendienteEtiqueta(''); setErrorEtiquetas('');
    } catch (e) { setErrorEtiquetas((e as Error).message); return; }
    setSubiendo(true);
    let exitosos = 0;
    const fallidos: { nombre: string; error: unknown }[] = [];
    let falloActualizacion = false;

    try {
      for (const pendiente of porSubir) {
        setPendientes((actuales) =>
          actuales.map((item) =>
            item.id === pendiente.id
              ? { ...item, estado: "subiendo", error: undefined }
              : item
          )
        );

        try {
          const guardado = await subirArchivo(
            pendiente.file,
            visibilidad === "publico",
            etiquetasCarga
          );

          setPendientes((actuales) =>
            actuales.map((item) =>
              item.id === pendiente.id
                ? { ...item, estado: "completado" }
                : item
            )
          );

          exitosos++;
          // El archivo ya está guardado: un fallo al refrescar la vista no debe permitir subirlo otra vez.
          try { await onUploaded(guardado); } catch { falloActualizacion = true; }
        } catch (error) {
          fallidos.push({ nombre: pendiente.file.name, error });
          const mensaje = error instanceof TypeError ? 'No se pudo conectar con el servidor.' : error instanceof Error ? error.message : 'No se pudo subir el archivo.';

          setPendientes((actuales) =>
            actuales.map((item) =>
              item.id === pendiente.id
                ? { ...item, estado: "error", error: mensaje }
                : item
            )
          );

        }
      }

      if (exitosos > 0 && fallidos.length === 0 && !falloActualizacion) {
        toast.success(
          exitosos === 1
            ? "Archivo guardado correctamente"
            : `${exitosos} archivos guardados correctamente`
        );
      }

      if (fallidos.length > 0) {
        const detalle = [exitosos ? `${exitosos} archivo(s) guardados. Solo se volverán a intentar los pendientes.` : '',
          ...fallidos.map(f => `${f.nombre}: ${f.error instanceof TypeError ? 'No se pudo conectar con el servidor.' : f.error instanceof Error ? f.error.message : 'No se pudo subir.'}`)].filter(Boolean).join('\n');
        avisarError(fallidos[0].error, fallidos.length === 1 ? 'No se pudo subir el archivo' : 'No se pudieron subir algunos archivos', detalle);
      } else if (falloActualizacion) {
        avisar({ titulo: 'Archivos guardados', mensaje: 'La carga terminó, pero no pudimos actualizar la lista. Recarga la página para verlos; no necesitas volver a subirlos.' });
      }

      if (fallidos.length === 0) {
        onClose();
      }
    } finally {
      setSubiendo(false);
    }
  };

  return {
    etiquetas, setEtiquetas, pendienteEtiqueta, setPendienteEtiqueta,
    errorEtiquetas, setErrorEtiquetas, pendientes, visibilidad, setVisibilidad,
    subiendo, agregarPendientes, quitarPendiente, cerrarModal, cargarPendientes,
  };
}
