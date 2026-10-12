import { formatoBytes } from "../services/usagePolicy";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
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
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [mostrarCarga, setMostrarCarga] = useState(false);

  const actualizarArchivos = async () => {
    try {
      const resultado = await listarArchivos();
      setArchivos(resultado);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los archivos"
      );
    }
  };

  useEffect(() => {
    let activo = true;

    listarArchivos()
      .then((resultado) => {
        if (activo) setArchivos(resultado);
      })
      .catch((error: Error) => {
        if (activo) toast.error(error.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

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
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la visibilidad"
      );
    }
  };

  const borrarArchivo = async (archivo: Archivo) => {
    if (
      !window.confirm(
        `¿Seguro que quieres eliminar "${archivo.nombre_original}"?`
      )
    ) {
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
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar"
      );
    } finally {
      setEliminando(null);
    }
  };

  const bajarArchivo = async (archivo: Archivo) => {
    try {
      await descargarArchivo(archivo.id, archivo.nombre_original);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo descargar"
      );
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
            onClick={() => setMostrarCarga(true)}
          >
            <Icon icon="lucide:upload" />
            Cargar archivo
          </button>
        </header>

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
              onClick={() => setMostrarCarga(true)}
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

                  <DetallesArchivo archivo={archivo} />
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
                    onClick={() => toast("Edición de nombre próximamente")}
                  >
                    <Icon icon="lucide:pencil" />
                  </button>

                  <button
                    type="button"
                    title="Mover archivo"
                    onClick={() => toast("Mover archivos próximamente")}
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
                    onClick={() => toast("Vista previa próximamente")}
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
          onClose={() => setMostrarCarga(false)}
          onUploaded={async () => {
            await actualizarArchivos();
          }}
        />
      )}
    </div>
  );
}

export default Archivos;
