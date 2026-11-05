import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Icon } from '@iconify/react';
import { estadoVistaPrevia, obtenerVistaPrevia, reintentarVistaPrevia, type Archivo, type EstadoVistaPrevia } from '../services/archivos';
import PaginaPdf from './PaginaPdf';

function DocumentoConvertido({ id }: { id: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState(false);
  useEffect(() => {
    const control = new AbortController();
    let tarea: PDFDocumentLoadingTask | undefined;
    async function abrir() {
      const [lector, blob] = await Promise.all([import('pdfjs-dist'), obtenerVistaPrevia(id, control.signal)]);
      const data = await blob.arrayBuffer();
      if (control.signal.aborted) return;
      lector.GlobalWorkerOptions.workerSrc = workerUrl;
      tarea = lector.getDocument({ data });
      const documento = await tarea.promise;
      if (!control.signal.aborted) setPdf(documento);
    }
    abrir().catch(() => { if (!control.signal.aborted) setError(true); });
    return () => { control.abort(); void tarea?.destroy(); };
  }, [id]);
  if (error) return <p role="alert">No se pudo cargar el documento. Cierra el visor e inténtalo de nuevo.</p>;
  if (!pdf) return <p role="status">Cargando documento…</p>;
  return <>
    <div className="visor-contenido"><PaginaPdf pdf={pdf} pagina={pagina} ancho={1400} /></div>
    <footer><button className="archivo-button" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
      <span aria-live="polite">{pagina} de {pdf.numPages}</span>
      <button className="archivo-button" disabled={pagina >= pdf.numPages} onClick={() => setPagina(p => p + 1)}>Siguiente</button></footer>
  </>;
}

export default function VistaPreviaOffice({ archivo }: { archivo: Archivo }) {
  const zona = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<EstadoVistaPrevia['estado']>('PENDIENTE');
  const [imagen, setImagen] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [reintentando, setReintentando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const observador = new IntersectionObserver(([entrada]) => setVisible(entrada.isIntersecting));
    if (zona.current) observador.observe(zona.current);
    return () => observador.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const control = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let url = '';
    setImagen('');
    setError('');
    async function consultar() {
      try {
        const resultado = await estadoVistaPrevia(archivo.id, control.signal);
        if (control.signal.aborted) return;
        setEstado(resultado.estado);
        if (resultado.estado === 'LISTA') {
          const blob = await obtenerVistaPrevia(archivo.id, control.signal, true);
          if (control.signal.aborted) return;
          url = URL.createObjectURL(blob);
          setImagen(url);
        } else if (resultado.estado !== 'FALLIDA') temporizador = setTimeout(consultar, 3000);
      } catch {
        if (!control.signal.aborted) setError('No se pudo consultar la vista previa.');
      }
    }
    void consultar();
    return () => { control.abort(); clearTimeout(temporizador); if (url) URL.revokeObjectURL(url); };
  }, [visible, archivo.id, revision]);

  async function reintentar() {
    setReintentando(true);
    try {
      const resultado = await reintentarVistaPrevia(archivo.id);
      if (resultado.estado === 'FALLIDA') setError('Espera un minuto desde el último intento para volver a preparar el documento.');
      else setRevision(v => v + 1);
    } catch { setError('No se pudo solicitar el reintento.'); }
    finally { setReintentando(false); }
  }

  return <div ref={zona} className="archivo-previa">
    <button className="archivo-miniatura" aria-label={'Ver vista previa de ' + archivo.nombre_original}
      disabled={!imagen || Boolean(error)} onClick={() => { setAbierto(true); dialogo.current?.showModal(); }}>
      <span className="miniatura-imagen miniatura-papel">
        {imagen ? <img src={imagen} alt="" onError={() => setError('No se pudo cargar la miniatura.')} /> : <Icon icon="lucide:file-text" />}
      </span>
      <span className="miniatura-accion">{imagen ? 'Ver vista previa ↗' : error || estado === 'FALLIDA' ? 'Vista previa no disponible' : 'Preparando vista previa…'}</span>
    </button>
    {(error || estado === 'FALLIDA') && <button className="previa-reintentar" disabled={reintentando}
      title={error || 'Volver a preparar el documento'} onClick={estado === 'FALLIDA' ? reintentar : () => setRevision(v => v + 1)}>
      {reintentando ? 'Solicitando…' : 'Reintentar'}
    </button>}
    <dialog ref={dialogo} className="archivo-visor" aria-label={archivo.nombre_original} onClose={() => setAbierto(false)}>
      <header><strong>{archivo.nombre_original}</strong><button className="archivo-button" autoFocus onClick={() => dialogo.current?.close()}>Cerrar</button></header>
      {abierto && <DocumentoConvertido id={archivo.id} />}
    </dialog>
  </div>;
}
