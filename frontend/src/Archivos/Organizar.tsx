import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { Carpeta } from '../services/archivos';

export type Operacion = { tipo: 'crear' } | { tipo: 'renombrar' | 'renombrarArchivo' | 'moverCarpeta' | 'moverArchivo'; id: string; nombre: string };

export function rutaDe(id: string | null, indice: Map<string, Carpeta>) {
  const ruta: Carpeta[] = [];
  while (id) {
    const carpeta = indice.get(id);
    if (!carpeta) break;
    ruta.push(carpeta);
    id = carpeta.carpeta_padre_id;
  }
  return ruta.reverse();
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export default function Organizar({ operacion, indice, actual, cerrar, guardar }: {
  operacion: Operacion; indice: Map<string, Carpeta>; actual: string | null;
  cerrar: () => void; guardar: (valor: string) => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const esArchivo = operacion.tipo === 'renombrarArchivo';
  const [valor, setValor] = useState(esArchivo || operacion.tipo === 'renombrar' ? operacion.nombre : '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const mover = operacion.tipo === 'moverArchivo' || operacion.tipo === 'moverCarpeta';
  const [busqueda, setBusqueda] = useState('');
  const destinos = useMemo(() => {
    if (!mover) return [];
    const opciones = [...indice.values()].flatMap(c => {
      const ruta = rutaDe(c.id, indice);
      if (c.id === actual || (operacion.tipo === 'moverCarpeta' && ruta.some(p => p.id === operacion.id))) return [];
      const padre = ['Mis archivos', ...ruta.slice(0, -1).map(p => p.nombre)].join(' / ');
      return [{ id: c.id, nombre: c.nombre, padre }];
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (actual !== null) opciones.unshift({ id: 'raiz', nombre: 'Mis archivos', padre: 'Carpeta principal' });
    return opciones;
  }, [actual, indice, mover, operacion]);
  const consulta = normalizar(busqueda.trim());
  const visibles = destinos.filter(c => normalizar(c.padre + ' / ' + c.nombre).includes(consulta));
  useEffect(() => { dialogo.current?.showModal(); }, []);
  const titulo = operacion.tipo === 'crear' ? 'Nueva carpeta' : operacion.tipo === 'renombrar' ? 'Renombrar carpeta' : esArchivo ? 'Editar nombre del archivo' : 'Mover a…';
  return <dialog ref={dialogo} className={`organizar-dialogo${mover ? ' organizar-mover' : ''}`} aria-labelledby="organizar-titulo"
    onCancel={e => { e.preventDefault(); if (!ocupado) cerrar(); }}>
    <form onSubmit={async e => {
      e.preventDefault();
      setOcupado(true);
      try { await guardar(valor); cerrar(); }
      catch (fallo) { setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar.'); setOcupado(false); }
    }}>
      <header className="organizar-encabezado">
        <span className="organizar-icono"><Icon icon={mover ? 'lucide:folder-input' : operacion.tipo === 'crear' ? 'lucide:folder-plus' : 'lucide:pencil'} aria-hidden="true" /></span>
        <div><h2 id="organizar-titulo">{titulo}</h2>
          {mover && <p>Elige dónde guardar <strong>{operacion.nombre}</strong></p>}
        </div>
        <button className="organizar-cerrar" type="button" aria-label="Cerrar" disabled={ocupado} onClick={cerrar}><Icon icon="lucide:x" /></button>
      </header>
      {mover ? <fieldset className="organizar-destinos" disabled={ocupado}>
        <legend>Carpeta de destino</legend>
        <label className="organizar-busqueda">
          <Icon icon="lucide:search" aria-hidden="true" />
          <input type="search" autoFocus aria-label="Buscar carpeta" placeholder="Buscar carpeta…" value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setValor(''); }} />
        </label>
        <div className="organizar-lista">
          {visibles.map(c => <label className="organizar-destino" key={c.id}>
            <input type="radio" name="destino" value={c.id} checked={valor === c.id} onChange={e => setValor(e.target.value)} required />
            <Icon icon={c.id === 'raiz' ? 'lucide:house' : 'lucide:folder'} aria-hidden="true" />
            <span><strong>{c.nombre}</strong><small>{c.padre}</small></span>
          </label>)}
          {destinos.length > 0 && visibles.length === 0 && <p role="status" className="organizar-sin-destinos">No se encontraron carpetas.</p>}
          {actual === null && destinos.length === 0 && <p className="organizar-sin-destinos">No hay carpetas disponibles. Crea una carpeta para poder mover este elemento.</p>}
        </div>
      </fieldset> : <label className="organizar-nombre">{esArchivo ? 'Nombre del archivo (incluida la extensión)' : 'Nombre de la carpeta'}
          <input placeholder={operacion.tipo === 'crear' ? 'Ej. Documentos' : undefined} autoFocus required maxLength={esArchivo ? undefined : 100} value={valor} onChange={e => setValor(e.target.value)} /></label>}
      {error && <p role="alert">{error}</p>}
      <div className="archivos-actions organizar-pie"><button className="archivo-button" type="button" disabled={ocupado} onClick={cerrar}>Cancelar</button>
        <button className="archivo-button primary" disabled={ocupado || !valor.trim()}>{ocupado ? 'Guardando…' : mover ? 'Mover aquí' : operacion.tipo === 'crear' ? 'Crear carpeta' : 'Guardar cambios'}</button></div>
    </form>
  </dialog>;
}
