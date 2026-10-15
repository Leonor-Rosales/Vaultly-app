import { useState } from 'react';
import { Icon } from '@iconify/react';
import Sidebar from '../components/Sidebar';
import Filtros from './Filtros';
import TarjetaArchivo from './TarjetaArchivo';
import { useBiblioteca } from './useBiblioteca';
import { tieneFiltros, textoResultados } from './estado';
import { ordenes } from './tipos';
import type { Orden } from './tipos';
import { demostracion } from './servicio';
import './Biblioteca.css';

export default function Biblioteca() {
  const {consulta, cambiar, limpiar, datos, error, cargando, reintentar} = useBiblioteca();
  const [menu, setMenu] = useState(false);
  const filtrado = tieneFiltros(consulta);
  return <div className={`biblioteca-page${menu ? ' biblioteca-menu-abierto' : ''}`}>
    <button type="button" className="biblioteca-menu-movil" aria-expanded={menu} aria-label={menu ? 'Cerrar navegación' : 'Abrir navegación'} onClick={() => setMenu(!menu)}><Icon icon={menu ? 'lucide:x' : 'lucide:menu'} /></button>
    <Sidebar />
    <main className="biblioteca-contenido">
      <header className="biblioteca-encabezado"><h1>Biblioteca Pública</h1><p>Explora y descarga recursos compartidos por la comunidad Vaultly</p>
        {demostracion && <span className="biblioteca-demo">Datos de demostración</span>}
      </header>
      <div className="biblioteca-buscador">
        <Icon icon="lucide:search" />
        <label className="biblioteca-sr" htmlFor="biblioteca-busqueda">Buscar por nombre, etiqueta o autor</label>
        <input id="biblioteca-busqueda" type="search" placeholder="Buscar por nombre, etiqueta o autor…" value={consulta.q} onChange={e => cambiar({q: e.target.value}, true)} />
        {consulta.q && <button type="button" aria-label="Borrar texto de búsqueda" onClick={() => cambiar({q: ''}, true)}><Icon icon="lucide:circle-x" /></button>}
      </div>
      <Filtros consulta={consulta} cambiar={cambiar} limpiar={limpiar} />
      <div className="biblioteca-resultados-barra">
        <p role="status" aria-live="polite">{cargando ? 'Buscando archivos…' : datos ? textoResultados(datos.total, datos.pagina, filtrado, datos.items.length) : 'No se pudieron cargar los resultados'}</p>
        <label className="biblioteca-select biblioteca-orden"><span>Ordenar:</span><select value={consulta.orden} onChange={e => cambiar({orden: e.target.value as Orden})}>
          {ordenes.map(o => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
        </select><Icon icon="lucide:chevron-down" /></label>
      </div>
      <section aria-label="Archivos públicos" aria-busy={cargando}>
        {cargando ? <div className="biblioteca-grid" aria-hidden="true">{Array.from({length: 12}, (_, i) => <div className="biblioteca-skeleton" key={i}><span /><span /><span /><span /></div>)}</div>
          : error ? <div className="biblioteca-vacio" role="alert"><span className="biblioteca-vacio-icono"><Icon icon="lucide:cloud-off" /></span><h2>No pudimos cargar la biblioteca</h2><p>{error}</p><button type="button" onClick={reintentar}>Reintentar</button></div>
          : datos?.items.length ? <div className="biblioteca-grid">{datos.items.map(a => <TarjetaArchivo key={a.id} archivo={a} demo={demostracion} />)}</div>
          : <div className="biblioteca-vacio">
            <span className="biblioteca-vacio-icono"><Icon icon={filtrado ? 'lucide:search-x' : 'lucide:folder-open'} /></span>
            <h2>{datos && datos.total > 0 ? 'No hay archivos en esta página' : consulta.q.trim() ? `No encontramos archivos para «${consulta.q.trim()}»` : filtrado ? 'No encontramos archivos con estos filtros' : 'Aún no hay archivos públicos'}</h2>
            <p>{filtrado ? 'Prueba buscando con otros términos o ajustando los filtros seleccionados.' : 'Aquí aparecerán los recursos que comparta la comunidad Vaultly.'}</p>
            {datos && datos.total > 0 ? <button type="button" onClick={() => cambiar({pagina: 1})}>Volver a la primera página</button> : filtrado && <button type="button" onClick={limpiar}>Limpiar búsqueda y filtros</button>}
          </div>}
      </section>
      {datos && datos.total > 12 && <nav className="biblioteca-paginacion" aria-label="Páginas de archivos">
        <button type="button" disabled={consulta.pagina === 1} onClick={() => cambiar({pagina: consulta.pagina - 1})}><Icon icon="lucide:chevron-left" />Anterior</button>
        <span>Página {consulta.pagina} de {Math.ceil(datos.total / 12)}</span>
        <button type="button" disabled={consulta.pagina >= Math.ceil(datos.total / 12)} onClick={() => cambiar({pagina: consulta.pagina + 1})}>Siguiente<Icon icon="lucide:chevron-right" /></button>
      </nav>}
    </main>
  </div>;
}
