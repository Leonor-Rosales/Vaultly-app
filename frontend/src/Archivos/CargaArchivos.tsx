import Etiquetas from '../components/Etiquetas';
import { incluirPendiente } from '../../../shared/etiquetas.mjs';
import { formatoBytes } from "../services/usagePolicy";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import "./CargaArchivos.css";
import {
  subirArchivo,
  type Archivo,
} from "../services/archivos";

type ArchivoPendiente = {
  id: string;
  file: File;
  estado: "pendiente" | "subiendo" | "completado" | "error";
};

type CargaArchivosProps = {
  onClose: () => void;
  onUploaded: (archivo: Archivo) => void | Promise<void>;
};

function CargaArchivos({
  onClose,
  onUploaded,
}: CargaArchivosProps) {
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [pendienteEtiqueta, setPendienteEtiqueta] = useState('');
  const [errorEtiquetas, setErrorEtiquetas] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [pendientes, setPendientes] = useState<ArchivoPendiente[]>([]);
  const [visibilidad, setVisibilidad] = useState<"privado" | "publico">(
    "privado"
  );
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

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
      toast.error("Selecciona al menos un archivo para cargar");
      return;
    }

    let etiquetasCarga: string[];
    try {
      etiquetasCarga = incluirPendiente(etiquetas, pendienteEtiqueta);
      setEtiquetas(etiquetasCarga); setPendienteEtiqueta(''); setErrorEtiquetas('');
    } catch (e) { setErrorEtiquetas((e as Error).message); return; }
    setSubiendo(true);
    let exitosos = 0;
    let fallidos = 0;

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

          await onUploaded(guardado);
          exitosos++;
        } catch (error) {
          fallidos++;

          setPendientes((actuales) =>
            actuales.map((item) =>
              item.id === pendiente.id
                ? { ...item, estado: "error" }
                : item
            )
          );

          toast.error(
            `${pendiente.file.name}: ${
              error instanceof Error
                ? error.message
                : "No se pudo subir"
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

      if (fallidos === 0) {
        onClose();
      }
    } finally {
      setSubiendo(false);
    }
  };

  return (
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
          onClick={() => inputRef.current?.click()}
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
          <p>o </p>

          <button
            type="button"
            className="archivo-button carga-seleccionar"
            onClick={() => inputRef.current?.click()}
          >
            <Icon icon="lucide:folder-open" />
            Seleccionar archivos
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              agregarPendientes(
                Array.from(event.target.files ?? [])
              );
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

        <Etiquetas etiquetas={etiquetas} pendiente={pendienteEtiqueta} error={errorEtiquetas}
          onChange={setEtiquetas} onPendiente={setPendienteEtiqueta} onError={setErrorEtiquetas} disabled={subiendo}
          ayuda="Se aplican a todos los archivos de esta carga." />
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
                  <strong title={item.file.name}>
                    {item.file.name}
                  </strong>

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
                  item.estado === "pendiente" ||
                  item.estado === "error"
              )
            }
            onClick={cargarPendientes}
          >
            <Icon
              icon={
                subiendo
                  ? "lucide:loader-circle"
                  : "lucide:upload"
              }
            />
            {subiendo ? "Cargando..." : "Cargar archivos"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default CargaArchivos;
