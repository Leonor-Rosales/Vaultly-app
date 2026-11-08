import Organizar, { rutaDe, type Operacion } from './Organizar';
import { listarCarpetas, crearCarpeta, renombrarArchivo, renombrarCarpeta, eliminarCarpeta, moverCarpeta, moverArchivo, type Carpeta } from '../services/archivos';
import VistaPrevia from './VistaPrevia';
import { formatoBytes } from "../services/usagePolicy";

import { useEffect, useState } from "react";
import { useLocation } from 'react-router-dom';
import { Icon } from "@iconify/react";
import { avisosCliente as toast } from '../cuenta/avisos';
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
  const { avisarError, confirmar } = useAvisos();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [actual, abrir] = useState<string | null>(null);
  const [operacion, organizar] = useState<Operacion | null>(null);
  const indice = new Map(carpetas.map(c => [c.id, c]));
  const hijas = carpetas.filter(c => c.carpeta_padre_id === actual).sort((a,b) => a.nombre.localeCompare(b.nombre));
  const visibles = archivos.filter(a => (a.carpeta_id ?? null) === actual);
  const guardar = async (valor: string) => {
    if (!operacion) return;
    if (operacion.tipo === 'renombrarArchivo') {
      const actualizado = await renombrarArchivo(operacion.id, valor);
      setArchivos(lista => lista.map(a => a.id === actualizado.id ? { ...a, ...actualizado } : a));
      return;
    }
    const destino = valor === 'raiz' ? null : valor;
    if (operacion.tipo === 'moverArchivo') {
      const { carpeta_id } = await moverArchivo(operacion.id, destino);
      setArchivos(lista => lista.map(a => a.id === operacion.id ? { ...a, carpeta_id } : a));
      return;
    }
    const carpeta = operacion.tipo === 'crear' ? await crearCarpeta(valor, actual)
      : operacion.tipo === 'renombrar' ? await renombrarCarpeta(operacion.id, valor)
      : await moverCarpeta(operacion.id, destino);
    setCarpetas(lista => [...lista.filter(c => c.id !== carpeta.id), carpeta]);
  };
  const borrarCarpeta = async (c: Carpeta) => {
    if (!await confirmar('¿Eliminar carpeta?', c.nombre)) return;
    try {
      await eliminarCarpeta(c.id);
      setCarpetas(lista => lista.filter(item => item.id !== c.id));
    } catch (error) { avisarError(error, 'No se pudo eliminar la carpeta', c.nombre); }
  };
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

    Promise.all([listarArchivos(), listarCarpetas()])
      .then(([lista, directorios]) => {
        if (activo) { setArchivos(lista); setCarpetas(directorios); }
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
    <div className="dashboard-page archivos-page">
      <Sidebar />

      <main className="dashboard-content archivos-content">
        <header className="archivos-header">
          <div className="archivos-navegacion">
          <button type="button" className="archivo-button archivos-regresar" disabled={!actual}
            onClick={() => abrir(actual ? indice.get(actual)?.carpeta_padre_id ?? null : null)}
            title="Subir a la carpeta que contiene la actual">
            <Icon icon="lucide:arrow-left" aria-hidden="true" />Regresar
          </button>
          <nav className="breadcrumbs" aria-label="Ruta de carpetas">
            <button onClick={() => abrir(null)}>Mis archivos</button>
            {rutaDe(actual, indice).map(c => <button key={c.id} onClick={() => abrir(c.id)}> / {c.nombre}</button>)}
          </nav>
          </div>
          <div className="archivos-actions"><button className="archivo-button" onClick={() => organizar({ tipo: 'crear' })}><Icon icon="lucide:folder-plus" aria-hidden="true" />Nueva carpeta</button>

          <button
            className="archivo-button primary"
            onClick={abrirCarga}
          >
            <Icon icon="lucide:upload" />
            Cargar archivo
          </button>
          </div>
        </header>
        <AvisosLimites almacenamiento />

        {cargando ? (
          <section className="archivos-vacio">
            <p>Cargando tus archivos...</p>
          </section>
        ) : visibles.length === 0 && hijas.length === 0 ? (
          <section className="archivos-vacio">
            <div className="vacio-icon">
              <Icon icon="lucide:folder" />
            </div>

            <h2>{actual ? 'Esta carpeta está vacía' : 'Tu espacio está vacío'}</h2>
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
          <>
          {hijas.length > 0 && <section aria-labelledby="titulo-carpetas">
            <h2 className="grupo-titulo" id="titulo-carpetas">Carpetas</h2>
            <div className="carpetas-grid">
            {hijas.map(c => <article className="carpeta-fila" key={c.id}>
              <button className="abrir-carpeta" onClick={() => abrir(c.id)}><Icon icon="lucide:folder" className="carpeta-icono" aria-hidden="true" /><span>{c.nombre}</span></button>
              <div className="archivo-card-actions">
                <button title="Renombrar carpeta" onClick={() => organizar({ tipo: 'renombrar', ...c })}><Icon icon="lucide:pencil" /></button>
                <button title="Mover carpeta" onClick={() => organizar({ tipo: 'moverCarpeta', ...c })}><Icon icon="lucide:arrow-left-right" /></button>
                <button title="Eliminar carpeta" onClick={() => borrarCarpeta(c)}><Icon icon="lucide:trash-2" /></button>
              </div>
            </article>)}
            </div>
          </section>}
          {visibles.length > 0 && <section aria-labelledby="titulo-archivos">
            <h2 className="grupo-titulo" id="titulo-archivos">Archivos</h2>
            <div className="archivos-grid">
            {visibles.map((archivo) => (
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

                <VistaPrevia archivo={archivo} />

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
                    onClick={() => organizar({ tipo: 'renombrarArchivo', id: archivo.id, nombre: archivo.nombre_original })}
                  >
                    <Icon icon="lucide:pencil" />
                  </button>

                  <button
                    type="button"
                    title="Mover archivo"
                    onClick={() => organizar({ tipo: 'moverArchivo', id: archivo.id, nombre: archivo.nombre_original })}
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
                    title="Descargar archivo"
                    onClick={() => bajarArchivo(archivo)}
                  >
                    <Icon icon="lucide:download" />
                  </button>
                </div>
              </article>
            ))}
            </div>
          </section>}
          </>
        )}
      </main>

      {operacion && <Organizar operacion={operacion} actual={actual} indice={indice} cerrar={() => organizar(null)} guardar={guardar} />}
      {mostrarCarga && (
        <CargaArchivos carpetaId={actual}
          onClose={() => setRutaCarga(null)}
          onUploaded={archivo => setArchivos(actuales => [archivo, ...actuales.filter(a => a.id !== archivo.id)])}
        />
      )}
    </div>
  );
}

export default Archivos;
