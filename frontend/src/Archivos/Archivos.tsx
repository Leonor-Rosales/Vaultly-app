import { formatoBytes } from "../services/usagePolicy";

import { useEffect, useState } from "react";
import { useLocation } from 'react-router-dom';
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useAvisos } from '../components/contextoAvisos';
import AvisosLimites from '../components/AvisosLimites';
import { obtenerConsumoActual } from '../services/consumo';
import { ApiError } from '../services/auth';
import Sidebar from "../components/Sidebar";
import {
  listarArchivos,
  eliminarArchivo,
  descargarArchivo,
  cambiarVisibilidad,
  type Archivo,
} from "../services/archivos";
import CargaArchivos from "../Archivos/CargaArchivos";
import DetallesArchivo from "./DetallesArchivo";
import "./Archivos.css";

function Archivos() {
  const location = useLocation();
  const { avisar, avisarError, confirmar } = useAvisos();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [rutaCarga, setRutaCarga] = useState<string | null>(null);
  // La carga pertenece a esta visita; «Administrar archivos» vuelve a una lista despejada.
  const mostrarCarga = rutaCarga === location.key;

  const abrirCarga = () => {
    const uso = obtenerConsumoActual()?.almacenamiento;
    if (uso && uso.usados_bytes >= uso.cuota_bytes) {
      avisarError(new ApiError('Has alcanzado el límite de almacenamiento de tu plan.', 409, 'CUOTA_ALMACENAMIENTO'), 'Almacenamiento lleno');
    } else setRutaCarga(location.key);
  };

  useEffect(() => {
    let activo = true;

    listarArchivos()
      .then((resultado) => {
        if (activo) setArchivos(resultado);
      })
      .catch((error: Error) => {
        if (activo) avisarError(error, 'No se pudieron cargar tus archivos');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [avisarError]);

  const formatoTamano = (valor: number | string) => formatoBytes(Number(valor));

  const iconoArchivo = (nombre: string) => {
    const extension = nombre.split(".").pop()?.toLowerCase();

    if (
      ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
        extension ?? ""
      )
    ) {
      return "lucide:image";
    }

    if (["zip", "rar", "7z"].includes(extension ?? "")) {
      return "lucide:archive";
    }

    if (
      ["ts", "tsx", "js", "jsx", "json", "html", "css"].includes(
        extension ?? ""
      )
    ) {
      return "lucide:code";
    }

    if (["pdf", "doc", "docx", "txt"].includes(extension ?? "")) {
      return "lucide:file-text";
    }

    return "lucide:file";
  };

  const alternarVisibilidad = async (archivo: Archivo) => {
    try {
      const actualizado = await cambiarVisibilidad(
        archivo.id,
        !archivo.es_publica
      );

      setArchivos((actuales) =>
        actuales.map((item) =>
          item.id === actualizado.id ? actualizado : item
        )
      );

      toast.success(
        actualizado.es_publica
          ? "Archivo publicado en tu cuenta"
          : "Archivo cambiado a privado"
      );
    } catch (error) {
      avisarError(error, 'No se pudo cambiar la visibilidad', archivo.nombre_original);
    }
  };

  const borrarArchivo = async (archivo: Archivo) => {
    if (!await confirmar('¿Eliminar archivo?', `Se eliminará «${archivo.nombre_original}» de tu cuenta. Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminando(archivo.id);

    try {
      await eliminarArchivo(archivo.id);

      setArchivos((actuales) =>
        actuales.filter((item) => item.id !== archivo.id)
      );

      toast.success("Archivo eliminado correctamente");
    } catch (error) {
      avisarError(error, 'No se pudo eliminar el archivo', archivo.nombre_original);
    } finally {
      setEliminando(null);
    }
  };

  const bajarArchivo = async (archivo: Archivo) => {
    try {
      await descargarArchivo(archivo.id, archivo.nombre_original);
    } catch (error) {
      avisarError(error, 'No se pudo descargar el archivo', archivo.nombre_original);
    }
  };

  return (
    <div className="dashboard-page">
      <Sidebar />

      <main className="dashboard-content archivos-content">
        <header className="archivos-header">
          <div className="breadcrumbs">
            <span>Mis Archivos</span>
            <span>/</span>
            <strong>Todos los archivos</strong>
          </div>

          <button
            className="archivo-button primary"
            onClick={abrirCarga}
          >
            <Icon icon="lucide:upload" />
            Cargar archivo
          </button>
        </header>
        <AvisosLimites almacenamiento />

        {cargando ? (
          <section className="archivos-vacio">
            <p>Cargando tus archivos...</p>
          </section>
        ) : archivos.length === 0 ? (
          <section className="archivos-vacio">
            <div className="vacio-icon">
              <Icon icon="lucide:folder" />
            </div>

            <h2>Tu espacio está vacío</h2>
            <p>
              Selecciona archivos para guardarlos de forma segura en Vaultly.
            </p>

            <button
              className="archivo-button primary"
              onClick={abrirCarga}
            >
              <Icon icon="lucide:upload" />
              Añadir primer archivo
            </button>
          </section>
        ) : (
          <section className="archivos-grid">
            {archivos.map((archivo) => (
              <article className="archivo-card" key={archivo.id}>
                <div className="archivo-card-top">
                  <button
                    type="button"
                    className={`archivo-badge ${
                      archivo.es_publica ? "public" : "private"
                    }`}
                    title="Cambiar visibilidad"
                    onClick={() => alternarVisibilidad(archivo)}
                  >
                    {archivo.es_publica ? "Público" : "Privado"}
                  </button>

                  <DetallesArchivo archivo={archivo} onUpdated={actualizado => setArchivos(actuales => actuales.map(a => a.id === actualizado.id ? actualizado : a))} />
                </div>

                <div className="archivo-card-icon">
                  <Icon icon={iconoArchivo(archivo.nombre_original)} />
                </div>

                <div className="archivo-card-info">
                  <p title={archivo.nombre_original}>
                    {archivo.nombre_original}
                  </p>
                  <span>{formatoTamano(archivo.tamanio_bytes)}</span>
                </div>

                <div className="archivo-card-actions">
                  <button
                    type="button"
                    title="Editar nombre"
                    onClick={() => avisar({ titulo: 'Edición de nombre', mensaje: 'Esta función todavía no está disponible. Por ahora, puedes cambiar el nombre antes de subir el archivo.' })}
                  >
                    <Icon icon="lucide:pencil" />
                  </button>

                  <button
                    type="button"
                    title="Mover archivo"
                    onClick={() => avisar({ titulo: 'Mover archivos', mensaje: 'Esta función todavía no está disponible. Tus archivos permanecen en su ubicación actual.' })}
                  >
                    <Icon icon="lucide:arrow-left-right" />
                  </button>

                  <button
                    type="button"
                    title="Eliminar archivo"
                    disabled={eliminando === archivo.id}
                    onClick={() => borrarArchivo(archivo)}
                  >
                    <Icon icon="lucide:trash-2" />
                  </button>

                  <button
                    type="button"
                    title="Vista previa"
                    onClick={() => avisar({ titulo: 'Vista previa', mensaje: 'Esta función todavía no está disponible. Puedes descargar el archivo para abrirlo en tu dispositivo.' })}
                  >
                    <Icon icon="lucide:eye" />
                  </button>

                  <button
                    type="button"
                    title="Descargar archivo"
                    onClick={() => bajarArchivo(archivo)}
                  >
                    <Icon icon="lucide:download" />
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {mostrarCarga && (
        <CargaArchivos
          onClose={() => setRutaCarga(null)}
          onUploaded={archivo => setArchivos(actuales => [archivo, ...actuales.filter(a => a.id !== archivo.id)])}
        />
      )}
    </div>
  );
}

export default Archivos;
