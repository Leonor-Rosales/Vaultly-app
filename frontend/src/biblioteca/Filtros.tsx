import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { tipos } from './tipos';
import type { Consulta } from './tipos';
import { biblioteca } from './servicio';
import { useRecurso } from './useBiblioteca';

function Desplegable({titulo, children}: {titulo: string; children: ReactNode}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (e.target instanceof Node && !ref.current?.contains(e.target)) ref.current?.removeAttribute('open'); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, []);
  return <details className="biblioteca-desplegable" ref={ref}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.removeAttribute('open'); }}
    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); ref.current?.removeAttribute('open'); ref.current?.querySelector('summary')?.focus(); } }}>
    <summary>{titulo}<Icon icon="lucide:chevron-down" /></summary>
    <div className="biblioteca-opciones">{children}</div>
  </details>;
}

export default function Filtros({consulta, cambiar, limpiar}: {
  consulta: Consulta; cambiar: (c: Partial<Consulta>, replace?: boolean) => void; limpiar: () => void;
}) {
  const [qEtiqueta, setQEtiqueta] = useState('');
  const [qAutor, setQAutor] = useState('');
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const pedirEtiquetas = useMemo(() => (s: AbortSignal) => biblioteca.etiquetas(qEtiqueta, s), [qEtiqueta]);
  const pedirAutores = useMemo(() => (s: AbortSignal) => biblioteca.autores(qAutor, s), [qAutor]);
  const etiquetas = useRecurso(pedirEtiquetas), autores = useRecurso(pedirAutores);
  const nombreEtiqueta = (id: number) => nombres[`e${id}`] || etiquetas.datos?.items.find(e => e.id === id)?.nombre || 'Etiqueta seleccionada';
  const nombreAutor = nombres[consulta.autor] || autores.datos?.items.find(a => a.id === consulta.autor)?.nombre_completo || 'Autor seleccionado';
  const activo = !!(consulta.q || consulta.tipo || consulta.autor || consulta.etiquetas.length);
  return <>
    <div className="biblioteca-filtros" aria-label="Filtros de biblioteca">
      <button type="button" className="biblioteca-todos" aria-pressed={!activo} onClick={limpiar}>Todos</button>
      <label className="biblioteca-select"><span className="biblioteca-sr">Tipo de archivo</span>
        <select value={consulta.tipo} onChange={e => cambiar({tipo: e.target.value as Consulta['tipo']})}>
          {tipos.map(t => <option key={t.valor} value={t.valor}>{t.valor ? t.nombre : 'Tipo de archivo'}</option>)}
        </select><Icon icon="lucide:chevron-down" />
      </label>
      <Desplegable titulo={`Etiquetas${consulta.etiquetas.length ? ` (${consulta.etiquetas.length})` : ''}`}>
        <label className="biblioteca-sr" htmlFor="biblioteca-buscar-etiqueta">Buscar etiquetas</label>
        <input id="biblioteca-buscar-etiqueta" placeholder="Buscar etiquetas…" value={qEtiqueta} onChange={e => setQEtiqueta(e.target.value)} />
        <p>Coincide con cualquiera de las etiquetas</p>
        {etiquetas.cargando && <p role="status">Cargando etiquetas…</p>}
        {etiquetas.error && <div role="alert">{etiquetas.error}<button type="button" onClick={etiquetas.reintentar}>Reintentar</button></div>}
        {etiquetas.datos?.items.length === 0 && <p>Sin etiquetas coincidentes.</p>}
        <div className="biblioteca-opciones-lista">{etiquetas.datos?.items.map(e => <label key={e.id}>
          <input type="checkbox" checked={consulta.etiquetas.includes(e.id)} onChange={() => {
            setNombres(n => ({...n, [`e${e.id}`]: e.nombre}));
            cambiar({etiquetas: consulta.etiquetas.includes(e.id) ? consulta.etiquetas.filter(id => id !== e.id) : [...consulta.etiquetas, e.id]});
          }} />{e.nombre}
        </label>)}</div>
      </Desplegable>
      <Desplegable titulo={consulta.autor ? nombreAutor : 'Autor'}>
        <label className="biblioteca-sr" htmlFor="biblioteca-buscar-autor">Buscar autores por nombre</label>
        <input id="biblioteca-buscar-autor" placeholder="Buscar por nombre…" value={qAutor} onChange={e => setQAutor(e.target.value)} />
        {autores.cargando && <p role="status">Cargando autores…</p>}
        {autores.error && <div role="alert">{autores.error}<button type="button" onClick={autores.reintentar}>Reintentar</button></div>}
        <div className="biblioteca-opciones-lista">
          <label><input type="radio" name="biblioteca-autor" checked={!consulta.autor} onChange={() => cambiar({autor: ''})} />Todos los autores</label>
          {autores.datos?.items.map(a => <label key={a.id}>
            <input type="radio" name="biblioteca-autor" checked={consulta.autor === a.id} onChange={() => {
              setNombres(n => ({...n, [a.id]: a.nombre_completo})); cambiar({autor: a.id});
            }} />{a.nombre_completo}
          </label>)}
        </div>
        {autores.datos?.items.length === 0 && <p>Sin autores coincidentes.</p>}
      </Desplegable>
      {activo && <button type="button" className="biblioteca-limpiar" onClick={limpiar}>Limpiar todo</button>}
    </div>
    {activo && <div className="biblioteca-activos" aria-label="Filtros activos">
      {consulta.q && <Ficha texto={`Búsqueda: ${consulta.q}`} quitar={() => cambiar({q: ''})} />}
      {consulta.tipo && <Ficha texto={tipos.find(t => t.valor === consulta.tipo)!.nombre} quitar={() => cambiar({tipo: ''})} />}
      {consulta.etiquetas.map(id => <Ficha key={id} texto={nombreEtiqueta(id)} quitar={() => cambiar({etiquetas: consulta.etiquetas.filter(e => e !== id)})} />)}
      {consulta.autor && <Ficha texto={nombreAutor} quitar={() => cambiar({autor: ''})} />}
    </div>}
  </>;
}
function Ficha({texto, quitar}: {texto: string; quitar: () => void}) {
  return <span>{texto}<button type="button" aria-label={`Quitar ${texto}`} onClick={quitar}><Icon icon="lucide:x" /></button></span>;
}
