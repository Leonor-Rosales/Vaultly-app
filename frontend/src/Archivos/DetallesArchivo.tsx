import Etiquetas from '../components/Etiquetas';
import { incluirPendiente } from '../../../shared/etiquetas.mjs';
import { editarEtiquetas } from '../services/archivos';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { Archivo } from '../services/archivos';
import { formatoBytes } from '../services/usagePolicy';
import { useAvisos } from '../components/contextoAvisos';

function tipoArchivo(archivo: Archivo) {
  const tipos: Record<string, string> = {
    'application/pdf': 'Documento PDF',
    'image/png': 'Imagen PNG', 'image/jpeg': 'Imagen JPEG',
    'image/gif': 'Imagen GIF', 'image/webp': 'Imagen WebP',
    'image/svg+xml': 'Imagen SVG', 'text/plain': 'Documento de texto',
    'application/zip': 'Archivo ZIP',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja de Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentación PowerPoint',
  };
  const extension = archivo.nombre_original.includes('.') ? archivo.nombre_original.split('.').pop() : '';
  return tipos[archivo.tipo_mime] || (extension ? `Archivo ${extension.toUpperCase()}` : 'Archivo');
}

export default function DetallesArchivo({ archivo, onUpdated }: { archivo: Archivo; onUpdated?: (archivo: Archivo) => void }) {
  const { avisarError } = useAvisos();
  const [borrador, setBorrador] = useState(archivo.etiquetas?.map(e => e.nombre) ?? []);
  const [pendiente, setPendiente] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const guardar = async () => {
    setMensaje(''); setError('');
    try {
      const nombres = incluirPendiente(borrador, pendiente);
      setGuardando(true);
      const actualizado = await editarEtiquetas(archivo.id, nombres);
      onUpdated?.(actualizado);
      setBorrador(actualizado.etiquetas.map(e => e.nombre)); setPendiente('');
      setMensaje('Etiquetas guardadas');
    } catch (e) { setError((e as Error).message); avisarError(e, 'No se pudieron guardar las etiquetas', archivo.nombre_original); }
    finally { setGuardando(false); }
  };
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const cerrar = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      panel.current?.hidePopover();
    };
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => {
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, []);

  return <>
    <button type="button" className="archivo-menu-button"
      title="Ver detalles" aria-label={`Ver detalles de ${archivo.nombre_original}`}
      aria-expanded={abierto} aria-controls={id}
      onClick={event => {
        if (panel.current?.matches(':popover-open')) { panel.current.hidePopover(); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        panel.current?.showPopover();
        const ancho = panel.current?.offsetWidth ?? 280;
        const alto = panel.current?.offsetHeight ?? 240;
        const debajo = rect.bottom + 8;
        setPosicion({
          left: Math.max(12, Math.min(rect.right - ancho, window.innerWidth - ancho - 12)),
          top: Math.max(12, debajo + alto <= window.innerHeight - 12 ? debajo : rect.top - alto - 8),
        });
      }}>
      <Icon icon="lucide:more-horizontal" />
    </button>
    <div ref={panel} id={id} popover="auto" className="archivo-detalles"
      role="region" aria-labelledby={`${id}-titulo`} style={posicion}
      onToggle={event => setAbierto(event.newState === 'open')}>
      <h3 id={`${id}-titulo`}>Detalles del archivo</h3>
      <dl>
        <div><dt>Nombre</dt><dd>{archivo.nombre_original}</dd></div>
        <div><dt>Tipo</dt><dd>{tipoArchivo(archivo)}</dd></div>
        <div><dt>Tamaño</dt><dd>{formatoBytes(Number(archivo.tamanio_bytes))}</dd></div>
        <div><dt>Fecha de subida</dt><dd>{new Date(archivo.created_at).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
        <div><dt>Visibilidad</dt><dd>{archivo.es_publica ? 'Público' : 'Privado'}</dd></div>
        <div><dt>Etiquetas guardadas</dt><dd>{archivo.etiquetas?.map(e => e.nombre).join(', ') || 'Sin etiquetas'}</dd></div>
      </dl>
      {onUpdated && <div className="archivo-detalles-edicion">
        <Etiquetas etiquetas={borrador} pendiente={pendiente} error={error} onChange={valor => { setBorrador(valor); setMensaje(''); }}
          onPendiente={valor => { setPendiente(valor); setMensaje(''); }} onError={setError} disabled={guardando} />
        <div className="archivo-detalles-guardar">
        <p role="status">{mensaje}</p>
        <button type="button" className="archivo-button primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar etiquetas'}
        </button>
        </div>
      </div>}
    </div>
  </>;
}
