import SelectorVista, { useVistaGuardada } from './SelectorVista';
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

type Elemento = { tipo: 'archivo' | 'carpeta'; id: string; nombre: string };
const clave = (item: Elemento) => item.tipo + ':' + item.id;

function Archivos() {
  const { vista, cambiarVista } = useVistaGuardada('mis-archivos-vista');
  const location = useLocation();
  const { avisarError, confirmar } = useAvisos();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [actual, setActual] = useState<string | null>(null);
  const [operacion, organizar] = useState<Operacion | null>(null);
  const indice = new Map(carpetas.map(c => [c.id, c]));
  const hijas = carpetas.filter(c => c.carpeta_padre_id === actual).sort((a,b) => a.nombre.localeCompare(b.nombre));
  const visibles = archivos.filter(a => (a.carpeta_id ?? null) === actual);
  const [seleccion, seleccionar] = useState<Elemento[]>([]);
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [resumen, setResumen] = useState('');
  const marcados = new Set(seleccion.map(clave));
  function abrir(id: string | null) {
    setActual(id);
    setModoSeleccion(false);
    seleccionar([]);
    setResumen('');
  }
  function iniciarSeleccion(item?: Elemento) {
    seleccionar(item ? [item] : []);
    setResumen('');
    setModoSeleccion(true);
  }
  function controlSeleccion(item: Elemento) {
    if (!modoSeleccion) return null;
    const id = clave(item);
    const marcado = marcados.has(id);
    return <button type="button" className="seleccion-tarjeta" aria-label={`Seleccionar ${item.nombre}`}
      aria-pressed={marcado} onClick={() => {
        setResumen('');
        seleccionar(lista => lista.some(i => clave(i) === id) ? lista.filter(i => clave(i) !== id) : [...lista, item]);
      }}>{marcado && <span aria-hidden="true">✓</span>}</button>;
  }
  async function aplicarSeleccion(accion: 'eliminar' | 'mover', destino: string | null = null) {
    if (procesando || !seleccion.length) return;
    if (accion === 'eliminar' && !await confirmar('¿Mover la selección a la papelera?',
      `Podrás restaurar los ${seleccion.length} elementos durante 30 días.`, 'Mover a la papelera')) return;
    setProcesando(true);
    setResumen('');
    const fallos: Elemento[] = [];
    let primerError = '';
    try {
      for (const item of seleccion) {
        try {
          if (item.tipo === 'archivo' && accion === 'eliminar') {
            await eliminarArchivo(item.id);
            setArchivos(lista => lista.filter(a => a.id !== item.id));
          } else if (item.tipo === 'archivo') {
            const { carpeta_id } = await moverArchivo(item.id, destino);
            setArchivos(lista => lista.map(a => a.id === item.id ? { ...a, carpeta_id } : a));
          } else if (accion === 'eliminar') {
            await eliminarCarpeta(item.id);
            retirarCarpeta(item.id);
          } else {
            const actualizada = await moverCarpeta(item.id, destino);
            setCarpetas(lista => lista.map(c => c.id === item.id ? actualizada : c));
          }
        } catch (error) {
          fallos.push(item);
          if (!primerError) primerError = item.nombre + ': ' + (error instanceof Error ? error.message : 'No se pudo completar la operación.');
        }
      }
      seleccionar(fallos);
      setModoSeleccion(fallos.length > 0);
      const hechos = seleccion.length - fallos.length;
      const resultado = accion === 'mover' ? 'Movidos' : 'En la papelera';
      setResumen(fallos.length ? `${resultado}: ${hechos}. Pendientes: ${fallos.length}. ${primerError}` : `${resultado}: ${hechos}.`);
    } finally {
      setProcesando(false);
    }
  }
  const guardar = async (valor: string) => {
    if (!operacion) return;
    if (operacion.tipo === 'renombrarArchivo') {
      const actualizado = await renombrarArchivo(operacion.id, valor);
      setArchivos(lista => lista.map(a => a.id === actualizado.id ? { ...a, ...actualizado } : a));
      return;
    }
    const destino = valor === 'raiz' ? null : valor;
    if (operacion.tipo === 'moverSeleccion') return aplicarSeleccion('mover', destino);
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
  function retirarCarpeta(id: string) {
    const retiradas = new Set(carpetas.filter(c => rutaDe(c.id, indice).some(p => p.id === id)).map(c => c.id));
    setCarpetas(lista => lista.filter(c => !retiradas.has(c.id)));
    setArchivos(lista => lista.filter(a => !a.carpeta_id || !retiradas.has(a.carpeta_id)));
  }
  const borrarCarpeta = async (c: Carpeta) => {
    if (!await confirmar('¿Mover la carpeta a la papelera?', `Podrás restaurar «${c.nombre}» y su contenido durante 30 días.`, 'Mover a la papelera')) return;
    try {
      await eliminarCarpeta(c.id);
      retirarCarpeta(c.id);
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
    if (!await confirmar('¿Mover el archivo a la papelera?', `Podrás restaurar «${archivo.nombre_original}» durante 30 días.`, 'Mover a la papelera')) {
      return;
    }

    setEliminando(archivo.id);

    try {
      await eliminarArchivo(archivo.id);

      setArchivos((actuales) =>
        actuales.filter((item) => item.id !== archivo.id)
      );

      toast.success("Archivo enviado a la papelera");
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

      <main className="dashboard-content archivos-content" data-vista={vista} inert={procesando} aria-busy={procesando}>
        <h1 className="titulo-pagina archivos-titulo">Mis archivos</h1>
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
          <div className="archivos-actions">
            <SelectorVista vista={vista} cambiarVista={cambiarVista} etiqueta="Vista de Mis archivos" />
            {!modoSeleccion && (visibles.length > 0 || hijas.length > 0) &&
              <button className="archivo-button" onClick={() => iniciarSeleccion()}><Icon icon="lucide:list-checks" aria-hidden="true" />Seleccionar</button>}
            <button className="archivo-button" onClick={() => organizar({ tipo: 'crear' })}><Icon icon="lucide:folder-plus" aria-hidden="true" />Nueva carpeta</button>

          <button
            className="archivo-button primary"
            onClick={abrirCarga}
          >
            <Icon icon="lucide:upload" />
            Cargar archivo
          </button>
          </div>
        </header>
        {modoSeleccion && <div className="archivos-lote" role="group" aria-label="Acciones de selección">
          <strong aria-live="polite">{seleccion.length} {seleccion.length === 1 ? 'seleccionado' : 'seleccionados'}</strong>
          <button className="archivo-button" disabled={!seleccion.length} onClick={() => organizar({
            tipo: 'moverSeleccion', nombre: `${seleccion.length} elemento(s)`,
            carpetas: seleccion.filter(i => i.tipo === 'carpeta').map(i => i.id),
          })}>Mover a…</button>
          <button className="archivo-button" disabled={!seleccion.length} onClick={() => aplicarSeleccion('eliminar')}>Mover a la papelera</button>
          <button className="archivo-button" onClick={() => { seleccionar([]); setModoSeleccion(false); }}>Cancelar</button>
        </div>}
        {resumen && <p role="status">{resumen}</p>}
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
            <h2 className="grupo-titulo titulo-seccion" id="titulo-carpetas">Carpetas</h2>
            <div className="carpetas-grid">
            {hijas.map(c => <article className="carpeta-fila" key={c.id}>
              {controlSeleccion({ tipo: 'carpeta', id: c.id, nombre: c.nombre })}
              <button inert={modoSeleccion} className="abrir-carpeta" onClick={() => abrir(c.id)}><Icon icon="lucide:folder" className="carpeta-icono" aria-hidden="true" /><span>{c.nombre}</span></button>
              <div className="archivo-card-actions" inert={modoSeleccion}>
                <details className="carpeta-menu">
                  <summary aria-label={`Opciones de ${c.nombre}`}><Icon icon="lucide:more-horizontal" aria-hidden="true" /></summary>
                  <button type="button" className="carpeta-menu-opcion accion-seleccionar" onClick={e => {
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    iniciarSeleccion({ tipo: 'carpeta', id: c.id, nombre: c.nombre });
                  }}><Icon icon="lucide:list-checks" aria-hidden="true" />Seleccionar</button>
                </details>
                <button title="Renombrar carpeta" onClick={() => organizar({ tipo: 'renombrar', ...c })}><Icon icon="lucide:pencil" /></button>
                <button title="Mover carpeta" onClick={() => organizar({ tipo: 'moverCarpeta', ...c })}><Icon icon="lucide:arrow-left-right" /></button>
                <button title="Mover carpeta a la papelera" onClick={() => borrarCarpeta(c)}><Icon icon="lucide:trash-2" /></button>
              </div>
            </article>)}
            </div>
          </section>}
          {visibles.length > 0 && <section aria-labelledby="titulo-archivos">
            <h2 className="grupo-titulo titulo-seccion" id="titulo-archivos">Archivos</h2>
            <div className="archivos-grid">
            {visibles.map((archivo) => (
              <article className="archivo-card" key={archivo.id}>
                <div className="archivo-card-top" inert={modoSeleccion}>
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

                  <DetallesArchivo archivo={archivo} onSeleccionar={() => iniciarSeleccion({ tipo: 'archivo', id: archivo.id, nombre: archivo.nombre_original })} onUpdated={actualizado => setArchivos(actuales => actuales.map(a => a.id === actualizado.id ? actualizado : a))} />
                </div>

                {vista === 'tarjetas' && <div className="seleccion-previa" inert={modoSeleccion}><VistaPrevia archivo={archivo} /></div>}

                {controlSeleccion({ tipo: 'archivo', id: archivo.id, nombre: archivo.nombre_original })}
                <div className="archivo-card-info">
                  <p title={archivo.nombre_original}>
                    {archivo.nombre_original}
                  </p>
                  <span>{formatoTamano(archivo.tamanio_bytes)}</span>
                </div>

                <div className="archivo-card-actions" inert={modoSeleccion}>
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
                    title="Mover archivo a la papelera"
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
