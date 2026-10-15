import { useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { descargarArchivo } from '../services/archivos';
import { formatoBytes } from '../services/usagePolicy';
import { categoria } from './estado';
import { tipos } from './tipos';
import type { ArchivoPublico } from './tipos';

export default function TarjetaArchivo({archivo, demo}: {archivo: ArchivoPublico; demo: boolean}) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');
  const ocupado = useRef(false);
  const tipo = tipos.find(t => t.valor === categoria(archivo.tipo_mime, archivo.nombre_original))!;
  const codigo = /\.(ts|js|html|css|py|json)$/i.test(archivo.nombre_original);
  const iniciales = archivo.autor.nombre_completo.trim().split(/\s+/).slice(0,2).map(n => n[0]).join('');
  const descargar = async () => {
    if (ocupado.current || demo) return;
    ocupado.current = true; setDescargando(true); setError('');
    try { await descargarArchivo(archivo.id, archivo.nombre_original); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar el archivo.'); }
    finally { ocupado.current = false; setDescargando(false); }
  };
  return <article className="biblioteca-tarjeta">
    <div className="biblioteca-tarjeta-superior">
      <span className="biblioteca-icono" title={tipo.nombre}><Icon icon={codigo ? 'lucide:code' : tipo.icono} /><span className="biblioteca-sr">{tipo.nombre}</span></span>
      <span>{formatoBytes(Number(archivo.tamanio_bytes))}</span>
    </div>
    <h2 title={archivo.nombre_original}>{archivo.nombre_original}</h2>
    <p className="biblioteca-autor"><span aria-hidden="true">{iniciales}</span>{archivo.autor.nombre_completo}</p>
    <div className="biblioteca-etiquetas">{archivo.etiquetas.map(e => <span key={e.id}>{e.nombre}</span>)}</div>
    <div className="biblioteca-tarjeta-pie">
      <span>{demo ? 'Requiere integración' : tipo.nombre}</span>
      <button type="button" disabled={demo || descargando} onClick={descargar} aria-label={`Descargar ${archivo.nombre_original}`}>
        <Icon icon={descargando ? 'lucide:loader-circle' : 'lucide:download'} />{descargando ? 'Descargando…' : 'Descargar'}
      </button>
    </div>
    {error && <p className="biblioteca-error-descarga" role="alert">{error}</p>}
  </article>;
}
