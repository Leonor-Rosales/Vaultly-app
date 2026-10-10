
import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
  listarArchivos,
  subirArchivo,
  type Archivo,
} from "../services/archivos";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

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

  const formatoTamano = (valor: number | string) => {
    const bytes = Number(valor);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  };

  const formatoFecha = (fecha: string) =>
    new Date(fecha).toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const iconoArchivo = (nombre: string) => {
    const extension = nombre.split(".").pop()?.toLowerCase();

    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension ?? "")) {
      return "lucide:image";
    }
    if (["zip", "rar", "7z"].includes(extension ?? "")) {
      return "lucide:archive";
    }
    if (["ts", "tsx", "js", "jsx", "json", "html", "css"].includes(extension ?? "")) {
      return "lucide:code-2";
    }
    if (["pdf", "doc", "docx", "txt"].includes(extension ?? "")) {
      return "lucide:file-text";
    }
    return "lucide:file";
  };

  const seleccionarArchivos = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const seleccionados = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!seleccionados.length) return;

    setSubiendo(true);
    let exitosos = 0;

    try {
      for (const archivo of seleccionados) {
        try {
          const guardado = await subirArchivo(archivo);
          setArchivos((actuales) => [
            guardado,
            ...actuales.filter((item) => item.id !== guardado.id),
          ]);
          exitosos++;
        } catch (error) {
          toast.error(
            `${archivo.name}: ${
              error instanceof Error ? error.message : "Error al subir"
            }`
          );
        }
      }

      if (exitosos > 0) {
        toast.success(
          exitosos === 1
            ? "Archivo guardado correctamente"
            : `${exitosos} archivos guardados correctamente`
        );
      }
    } finally {
      setSubiendo(false);
    }
  };

  const espacioUsado = archivos.reduce(
    (total, archivo) => total + Number(archivo.tamanio_bytes),
    0
  );

  const capacidad = 20 * 1024 ** 3;
  const porcentaje = Math.min((espacioUsado / capacidad) * 100, 100);

  const recientes = [...archivos]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="dashboard-page">
      <Sidebar />

      <main className="dashboard-content">
        <div className="dashboard-header">
          <h1>Dashboard</h1>

          <button
            className="upload-button"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            <Icon icon="lucide:upload" />
            {subiendo ? "Subiendo..." : "Cargar archivo"}
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={seleccionarArchivos}
          />
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Plan actual</span>
            <strong>Standard</strong>
            <small>Tu plan inicial de Vaultly</small>
          </div>

          <div className="stat-card storage-card">
            <span className="stat-title">Almacenamiento</span>
            <strong>{formatoTamano(espacioUsado)} de 20 GB</strong>
            <span className="storage-text">usados</span>
            <div className="storage-bar">
              <div
                className="storage-progress"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-title">Archivos guardados</span>
            <strong>{archivos.length}</strong>
            <small>Archivos en tu cuenta</small>
          </div>

          <div className="stat-card">
            <span className="stat-title">Archivos públicos compartidos</span>
            <strong>{archivos.filter((a) => a.es_publica).length} recursos</strong>
            <small>Visibles en tu biblioteca pública</small>
          </div>
        </section>

        <section className="recent-files">
          <div className="recent-files-header">
            <h2>Archivos recientes</h2>
            <button
              className="view-all-button"
              onClick={() => navigate("/archivos")}
            >
              Ver todos <Icon icon="lucide:arrow-right" />
            </button>
          </div>

          {cargando ? (
            <div className="dashboard-empty">
              <p>Cargando tus archivos...</p>
            </div>
          ) : recientes.length === 0 ? (
            <div className="dashboard-empty">
              <Icon icon="lucide:folder-open" />
              <h3>Aún no tienes archivos</h3>
              <p>Los archivos que subas aparecerán aquí.</p>
              <button
                className="upload-button"
                onClick={() => inputRef.current?.click()}
              >
                <Icon icon="lucide:upload" />
                Subir mi primer archivo
              </button>
            </div>
          ) : (
            <div className="files-table">
              <div className="file-row file-header">
                <span>Nombre del archivo</span>
                <span>Fecha de carga</span>
                <span>Visibilidad</span>
              </div>

              {recientes.map((archivo) => (
                <div className="file-row" key={archivo.id}>
                  <div className="file-name">
                    <div className="file-icon">
                      <Icon icon={iconoArchivo(archivo.nombre_original)} />
                    </div>
                    <span title={archivo.nombre_original}>
                      {archivo.nombre_original}
                    </span>
                  </div>

                  <span>{formatoFecha(archivo.created_at)}</span>

                  <span
                    className={`visibility ${
                      archivo.es_publica ? "public" : "private"
                    }`}
                  >
                    {archivo.es_publica ? "Público" : "Privado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
