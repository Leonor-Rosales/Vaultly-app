import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { formatoVistaPrevia, limiteTexto } from '../../../shared/vista-previa.mjs';
import { ContenidoTexto, leerTabla } from './ContenidoTexto';
import { useMemo } from 'react';
import { obtenerVistaPrevia, type Archivo } from '../services/archivos';
import { iconoArchivo } from './iconoArchivo';

function PaginaPdf({ pdf, pagina, ancho }: { pdf: PDFDocumentProxy; pagina: number; ancho: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let activo = true;
    let tarea: RenderTask | undefined;
    setFallo(false);
    async function dibujar() {
      const hoja = await pdf.getPage(pagina);
      if (!activo || !canvas.current) return;
      const base = hoja.getViewport({ scale: 1 });
      const viewport = hoja.getViewport({ scale: Math.min(ancho / base.width, ancho * 1.5 / base.height) });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      tarea = hoja.render({ canvas: canvas.current, viewport });
      await tarea.promise;
    }
    dibujar().catch(() => { if (activo) setFallo(true); });
    return () => { activo = false; tarea?.cancel(); };
  }, [pdf, pagina, ancho]);
  return fallo ? <span>Página no disponible</span> : <canvas ref={canvas} aria-label={`Página ${pagina}`} />;
}

export default function VistaPrevia({ archivo }: { archivo: Archivo }) {
  const formato = formatoVistaPrevia(archivo.nombre_original, archivo.tipo_mime);
  return <ContenidoVista key={formato} archivo={archivo} formato={formato} />;
}

function ContenidoVista({ archivo, formato }: { archivo: Archivo; formato: ReturnType<typeof formatoVistaPrevia> }) {
  const [texto, setTexto] = useState<string | null>(null);
  const tabla = useMemo(() => texto !== null && (formato === 'csv' || formato === 'tsv')
    ? leerTabla(texto, formato) : null, [texto, formato]);
  const zona = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [cargar, setCargar] = useState(false);
  const [imagen, setImagen] = useState('');
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [pagina, setPagina] = useState(1);
  const compatible = Boolean(formato);
  useEffect(() => {
    if (!compatible || !zona.current) return;
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { setCargar(true); observador.disconnect(); }
    });
    observador.observe(zona.current);
    return () => observador.disconnect();
  }, [compatible]);
  useEffect(() => {
    if (!cargar) return;
    const abortar = new AbortController();
    let url = '';
    let tarea: PDFDocumentLoadingTask | undefined;
    async function preparar() {
      const blob = await obtenerVistaPrevia(archivo.id, abortar.signal);
      if (formato === 'texto' || formato === 'csv' || formato === 'tsv') {
        const datos = await blob.arrayBuffer();
        const contenido = new TextDecoder('utf-8', { fatal: true }).decode(datos, { stream: Number(archivo.tamanio_bytes) > limiteTexto });
        if (contenido.includes('\0')) throw new Error('Contenido binario');
        if (!abortar.signal.aborted) setTexto(contenido);
      } else if (formato === 'pdf') {
        const [lector, data] = await Promise.all([import('pdfjs-dist'), blob.arrayBuffer()]);
        if (abortar.signal.aborted) return;
        lector.GlobalWorkerOptions.workerSrc = workerUrl;
        tarea = lector.getDocument({ data });
        const documento = await tarea.promise;
        if (!abortar.signal.aborted) setPdf(documento);
      } else if (!abortar.signal.aborted) {
        url = URL.createObjectURL(blob);
        setImagen(url);
      }
    }
    preparar().catch(() => { if (!abortar.signal.aborted) setError(true); });
    return () => { abortar.abort(); if (url) URL.revokeObjectURL(url); void tarea?.destroy(); };
  }, [archivo.id, archivo.tamanio_bytes, formato, cargar]);

  const [abierto, setAbierto] = useState(false);
  const listo = Boolean(imagen || pdf || texto !== null);
  if (!compatible) return <div className="archivo-card-icon"><Icon icon={iconoArchivo(archivo.nombre_original)} /></div>;
  return <div ref={zona} className="archivo-previa">
    <button className="archivo-miniatura" disabled={error || !listo}
      aria-label={`Ver vista previa de ${archivo.nombre_original}`}
      onClick={() => { setPagina(1); setAbierto(true); dialogo.current?.showModal(); }}>
      <span className={pdf ? 'miniatura-imagen miniatura-papel' : 'miniatura-imagen'}>
      {texto !== null ? <ContenidoTexto texto={texto} tabla={tabla} miniatura /> : pdf ? <PaginaPdf pdf={pdf} pagina={1} ancho={540} /> : imagen && !error
        ? <img src={imagen} alt="" onError={() => setError(true)} /> : <Icon icon={iconoArchivo(archivo.nombre_original)} />}
      </span>
      <span className="miniatura-accion">{error ? 'Vista previa no disponible' : listo ? 'Ver vista previa' : 'Cargando vista previa…'}{!error && listo && <span aria-hidden="true">↗</span>}</span>
    </button>
    <dialog ref={dialogo} className="archivo-visor" aria-label={archivo.nombre_original} onClose={() => setAbierto(false)}>
      <header><strong>{archivo.nombre_original}</strong><button autoFocus className="archivo-button" onClick={() => dialogo.current?.close()}>Cerrar</button></header>
      {abierto && <div className="visor-contenido">{texto !== null ? <ContenidoTexto texto={texto} tabla={tabla} /> : pdf ? <PaginaPdf pdf={pdf} pagina={pagina} ancho={1400} /> : <img src={imagen} alt={archivo.nombre_original} />}</div>}
      {texto !== null && Number(archivo.tamanio_bytes) > limiteTexto && <p>Vista parcial. Se muestran los primeros 128 KiB.</p>}
      {pdf && <footer><button className="archivo-button" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
        <span aria-live="polite">{pagina} de {pdf.numPages}</span>
        <button className="archivo-button" disabled={pagina >= pdf.numPages} onClick={() => setPagina(p => p + 1)}>Siguiente</button></footer>}
    </dialog>
  </div>;
}
