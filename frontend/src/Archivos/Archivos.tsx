
import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import {
  listarArchivos,
  subirArchivo,
  eliminarArchivo,
  descargarArchivo,
  cambiarVisibilidad,
  type Archivo,
} from "../services/archivos";
import "./Archivos.css";

type ArchivoPendiente = {
  id: string;
  file: File;
  estado: "pendiente" | "subiendo" | "completado" | "error";
};

function Archivos() {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [pendientes, setPendientes] = useState<ArchivoPendiente[]>([]);
  const [visibilidad, setVisibilidad] = useState<"privado" | "publico">(
    "privado"
  );
  const [arrastrando, setArrastrando] = useState(false);

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

  const iconoArchivo = (nombre: string) => {
    const extension = nombre.split(".").pop()?.toLowerCase();

    if (
      ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension ?? "")
    ) return "lucide:image";

    if (["zip", "rar", "7z"].includes(extension ?? "")) {
      return "lucide:archive";
    }

    if (
      ["ts", "tsx", "js", "jsx", "json", "html", "css"].includes(
        extension ?? ""
      )
    ) return "lucide:code";

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
        error instanceof Error ? error.message : "No se pudo cambiar la visibilidad"
      );
    }
  };

  const agregarPendientes = (seleccionados: File[]) => {
    if (!seleccionados.length) return;

    setPendientes((actuales) => {
      const nuevos = seleccionados
        .filter((file) => {
          const duplicado = actuales.some(
            (item) =>
              item.file.name === file.name &&
              item.file.size === file.size &&
              item.file.lastModified === file.lastModified
          );

          return !duplicado;
        })
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          estado: "pendiente" as const,
        }));

      return [...actuales, ...nuevos];
    });
  };

  const quitarPendiente = (id: string) => {
    setPendientes((actuales) => actuales.filter((item) => item.id !== id));
  };

  const cerrarModal = () => {
    if (subiendo) return;

    setModalAbierto(false);
    setPendientes([]);
    setVisibilidad("privado");
  };

  const cargarPendientes = async () => {
    const porSubir = pendientes.filter(
      (item) => item.estado === "pendiente" || item.estado === "error"
    );

    if (!porSubir.length) {
      toast.error("Selecciona al menos un archivo para cargar");
      return;
    }

    setSubiendo(true);
    let exitosos = 0;

    try {
      for (const pendiente of porSubir) {
        setPendientes((actuales) =>
          actuales.map((item) =>
            item.id === pendiente.id
              ? { ...item, estado: "subiendo" }
              : item
          )
        );

        try {
          const guardado = await subirArchivo(
            pendiente.file,
            visibilidad === "publico"
          );

          setArchivos((actuales) => [
            guardado,
            ...actuales.filter((item) => item.id !== guardado.id),
          ]);

          setPendientes((actuales) =>
            actuales.map((item) =>
              item.id === pendiente.id
                ? { ...item, estado: "completado" }
                : item
            )
          );

          exitosos++;
        } catch (error) {
          setPendientes((actuales) =>
            actuales.map((item) =>
              item.id === pendiente.id ? { ...item, estado: "error" } : item
            )
          );

          toast.error(
            `${pendiente.file.name}: ${
              error instanceof Error ? error.message : "No se pudo subir"
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

      const quedanPendientes = pendientes.some(
        (item) =>
          item.estado === "pendiente" ||
          item.estado === "error"
      );

      if (!quedanPendientes || exitosos === porSubir.length) {
        setModalAbierto(false);
        setPendientes([]);
        setVisibilidad("privado");
      }
    } finally {
      setSubiendo(false);
    }
  };

  const borrarArchivo = async (archivo: Archivo) => {
    if (!window.confirm(`¿Seguro que quieres eliminar "${archivo.nombre_original}"?`)) {
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
        error instanceof Error ? error.message : "No se pudo eliminar"
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
        error instanceof Error ? error.message : "No se pudo descargar"
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
            onClick={() => setModalAbierto(true)}
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
            <p>Selecciona archivos para guardarlos de forma segura en Vaultly.</p>
            <button
              className="archivo-button primary"
              onClick={() => setModalAbierto(true)}
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

                  <button
                    type="button"
                    className="archivo-menu-button"
                    title="Más opciones"
                    onClick={() => toast("Más opciones próximamente")}
                  >
                    <Icon icon="lucide:more-horizontal" />
                  </button>
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

      {modalAbierto && (
        <div
          className="carga-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrarModal();
          }}
        >
          <section
            className="carga-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="carga-titulo"
          >
            <header className="carga-modal-header">
              <div>
                <h2 id="carga-titulo">Cargar archivos</h2>
                <p>Añade archivos a tu espacio seguro de Vaultly.</p>
              </div>

              <button
                className="carga-cerrar"
                type="button"
                disabled={subiendo}
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                <Icon icon="lucide:x" />
              </button>
            </header>

            <div
              className={`carga-dropzone ${arrastrando ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(event) => {
                event.preventDefault();
                setArrastrando(false);
                agregarPendientes(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="carga-cloud-icon">
                <Icon icon="lucide:cloud-upload" />
              </div>

              <h3>Arrastra tus archivos aquí</h3>
              <p>o selecciona archivos desde tu computadora</p>

              <button
                type="button"
                className="archivo-button carga-seleccionar"
                onClick={() => modalInputRef.current?.click()}
              >
                <Icon icon="lucide:folder-open" />
                Seleccionar archivos
              </button>

              <input
                ref={modalInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  agregarPendientes(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />

              <span className="carga-limite">
                Tamaño máximo: 50 MB por archivo
              </span>
            </div>

            <div className="carga-visibilidad">
              <div>
                <h3>Visibilidad de los archivos</h3>
                <p>Podrás cambiarla después desde cada tarjeta.</p>
              </div>

              <div className="carga-visibilidad-opciones">
                <button
                  type="button"
                  className={visibilidad === "privado" ? "selected" : ""}
                  onClick={() => setVisibilidad("privado")}
                  disabled={subiendo}
                >
                  <Icon icon="lucide:lock" />
                  Privado
                </button>

                <button
                  type="button"
                  className={visibilidad === "publico" ? "selected" : ""}
                  onClick={() => setVisibilidad("publico")}
                  disabled={subiendo}
                >
                  <Icon icon="lucide:globe" />
                  Público
                </button>
              </div>
            </div>

            {pendientes.length > 0 && (
              <div className="carga-lista">
                <div className="carga-lista-titulo">
                  <strong>Archivos seleccionados</strong>
                  <span>{pendientes.length}</span>
                </div>

                {pendientes.map((item) => (
                  <div className="carga-item" key={item.id}>
                    <div className="carga-item-icon">
                      <Icon icon={iconoArchivo(item.file.name)} />
                    </div>

                    <div className="carga-item-info">
                      <strong title={item.file.name}>{item.file.name}</strong>
                      <span>
                        {formatoTamano(item.file.size)} ·{" "}
                        {item.estado === "pendiente" && "Pendiente"}
                        {item.estado === "subiendo" && "Subiendo..."}
                        {item.estado === "completado" && "Completado"}
                        {item.estado === "error" && "Error al subir"}
                      </span>
                      <div className="carga-progreso">
                        <div
                          className={`carga-progreso-barra ${item.estado}`}
                        />
                      </div>
                    </div>

                    {item.estado !== "subiendo" && !subiendo && (
                      <button
                        type="button"
                        className="carga-quitar"
                        title="Quitar archivo"
                        onClick={() => quitarPendiente(item.id)}
                      >
                        <Icon icon="lucide:x" />
                      </button>
                    )}

                    {item.estado === "completado" && (
                      <Icon
                        icon="lucide:check-circle"
                        className="carga-check"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <footer className="carga-modal-footer">
              <button
                type="button"
                className="carga-cancelar"
                disabled={subiendo}
                onClick={cerrarModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="archivo-button primary carga-confirmar"
                disabled={
                  subiendo ||
                  !pendientes.some(
                    (item) =>
                      item.estado === "pendiente" || item.estado === "error"
                  )
                }
                onClick={cargarPendientes}
              >
                <Icon icon={subiendo ? "lucide:loader-circle" : "lucide:upload"} />
                {subiendo ? "Cargando..." : "Cargar archivos"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default Archivos;
