
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { avisosCliente as toast } from '../cuenta/avisos';
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import CargaArchivos from "../Archivos/CargaArchivos";
import "../Archivos/Archivos.css";
import { useConsumo, obtenerConsumoActual } from '../services/consumo';
import { formatoBytes, porcentajeAlmacenamiento, textoPorcentaje } from '../services/usagePolicy';
import {
  listarArchivos,
  type Archivo,
} from "../services/archivos";
import "./Dashboard.css";

import { useAvisos } from '../components/contextoAvisos';
import AvisosLimites from '../components/AvisosLimites';
import { ApiError } from '../services/auth';
function Dashboard() {
  const { avisarError } = useAvisos();
  const abrirCarga = () => {
    const uso = obtenerConsumoActual()?.almacenamiento;
    if (uso && uso.usados_bytes >= uso.cuota_bytes) avisarError(new ApiError('Has alcanzado el límite de almacenamiento de tu plan.',409,'CUOTA_ALMACENAMIENTO'),'Almacenamiento lleno');
    else setMostrarCarga(true);
  };
  const navigate = useNavigate();

  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarCarga, setMostrarCarga] = useState(false);
  const { consumo, error: errorConsumo } = useConsumo();

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

  const porcentaje = consumo ? porcentajeAlmacenamiento(consumo.almacenamiento.usados_bytes, consumo.almacenamiento.cuota_bytes) : 0;

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
            onClick={abrirCarga}
          >
            <Icon icon="lucide:upload" />
            Cargar archivo
          </button>
        </div>

        <AvisosLimites almacenamiento descargas />
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Plan actual</span>
            <strong>{consumo?.plan.nombre ?? '—'}</strong>
            <small>{errorConsumo || (consumo ? `Fin del ciclo: ${new Date(consumo.descargas.fin).toLocaleDateString('es-GT', { timeZone: 'UTC' })}` : 'Consultando tu plan…')}</small>
          </div>

          <div className="stat-card storage-card">
            <span className="stat-title">Almacenamiento</span>
            <strong>{consumo ? `${formatoBytes(consumo.almacenamiento.usados_bytes)} de ${formatoBytes(consumo.almacenamiento.cuota_bytes)} usados` : '—'}</strong>
            <div className="storage-bar" role="progressbar" aria-label="Almacenamiento utilizado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(porcentaje, 100)} aria-valuetext={`${textoPorcentaje(porcentaje)} utilizados`}>
              <div
                className="storage-progress uso-relleno"
                style={{ width: `${Math.min(porcentaje, 100)}%`, minWidth: porcentaje > 0 ? '4px' : 0 }}
              />
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-title">Descargas</span>
            <strong className="download-number"><Icon icon="lucide:download" />{consumo ? `${consumo.descargas.consumidas}/${consumo.descargas.ilimitadas ? '∞' : consumo.descargas.limite}` : '—'}</strong>
            <small>{consumo ? `${consumo.descargas.ilimitadas ? 'Sin límite · ' : ''}Se renuevan el ${new Date(consumo.descargas.fin).toLocaleDateString('es-GT', { timeZone: 'UTC' })}` : 'Consultando renovación…'}</small>
          </div>

          <div className="stat-card">
            <span className="stat-title">Total de archivos</span>
            <strong>{cargando ? '—' : `${archivos.length} ${archivos.length === 1 ? 'archivo' : 'archivos'}`}</strong>
            <small>Públicos y privados en tu cuenta</small>
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
                onClick={abrirCarga}
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
      {mostrarCarga && <CargaArchivos
        onClose={() => setMostrarCarga(false)}
        onUploaded={(archivo) => setArchivos(actuales => [archivo, ...actuales.filter(a => a.id !== archivo.id)])}
      />}
    </div>
  );
}

export default Dashboard;
