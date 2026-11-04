import { useEffect, useRef, useState } from 'react';
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
  useEffect(() => { dialogo.current?.showModal(); }, []);
  const titulo = operacion.tipo === 'crear' ? 'Nueva carpeta' : operacion.tipo === 'renombrar' ? 'Renombrar carpeta' : esArchivo ? 'Editar nombre del archivo' : 'Mover a…';
  return <dialog ref={dialogo} className="organizar-dialogo" aria-labelledby="organizar-titulo"
    onCancel={e => { e.preventDefault(); if (!ocupado) cerrar(); }}>
    <form onSubmit={async e => {
      e.preventDefault();
      setOcupado(true);
      try { await guardar(valor); cerrar(); }
      catch (fallo) { setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar.'); setOcupado(false); }
    }}>
      <h2 id="organizar-titulo">{titulo}</h2>
      {mover ? <label>Destino de «{operacion.nombre}»
        <select required autoFocus value={valor} onChange={e => setValor(e.target.value)}>
          <option value="">Selecciona una ubicación</option>
          {actual !== null && <option value="raiz">Mis archivos</option>}
          {[...indice.values()].map(c => {
            const ruta = rutaDe(c.id, indice);
            if (c.id === actual || (operacion.tipo === 'moverCarpeta' && ruta.some(p => p.id === operacion.id))) return null;
            return <option key={c.id} value={c.id}>Mis archivos / {ruta.map(p => p.nombre).join(' / ')}</option>;
          })}
        </select></label> : <label>{esArchivo ? 'Nombre del archivo (incluida la extensión)' : 'Nombre de la carpeta'}
          <input autoFocus required maxLength={esArchivo ? undefined : 100} value={valor} onChange={e => setValor(e.target.value)} /></label>}
      {error && <p role="alert">{error}</p>}
      <div className="archivos-actions"><button className="archivo-button" type="button" disabled={ocupado} onClick={cerrar}>Cancelar</button>
        <button className="archivo-button primary" disabled={ocupado || !valor.trim()}>{mover ? 'Mover' : 'Guardar'}</button></div>
    </form>
  </dialog>;
}
