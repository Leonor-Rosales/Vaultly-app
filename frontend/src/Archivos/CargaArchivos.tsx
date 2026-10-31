import Etiquetas from '../components/Etiquetas';
import { formatoBytes } from "../services/usagePolicy";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { Archivo } from '../services/archivos';
import { useCargaArchivos } from './useCargaArchivos';
import { iconoArchivo } from './iconoArchivo';
import "./CargaArchivos.css";

type CargaArchivosProps = {
  onClose: () => void;
  onUploaded: (archivo: Archivo) => void | Promise<void>;
};

function CargaArchivos({ onClose, onUploaded }: CargaArchivosProps) {
  const {
    etiquetas, setEtiquetas, pendienteEtiqueta, setPendienteEtiqueta,
    errorEtiquetas, setErrorEtiquetas, pendientes, visibilidad, setVisibilidad,
    subiendo, agregarPendientes, quitarPendiente, cerrarModal, cargarPendientes,
  } = useCargaArchivos({ onClose, onUploaded });
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const formatoTamano = (valor: number | string) => formatoBytes(Number(valor));

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
                  {item.error && <p className="carga-error-archivo">{item.error}</p>}

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
