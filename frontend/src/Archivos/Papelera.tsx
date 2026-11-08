import SelectorVista, { useVistaGuardada } from './SelectorVista';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import Sidebar from '../components/Sidebar';
import { useAvisos } from '../components/contextoAvisos';
import { actualizarConsumo } from '../services/consumo';
import { formatoBytes } from '../services/usagePolicy';
import { consultarPapelera, restaurarEntrada, purgarEntrada, type ContenidoPapelera, type EntradaPapelera } from '../services/papelera';
import VistaPrevia from './VistaPrevia';
import './Archivos.css';
import './Papelera.css';

const fecha = new Intl.DateTimeFormat('es-GT', {dateStyle:'medium', timeStyle:'short'});
export default function Papelera() {
  const { vista, cambiarVista } = useVistaGuardada('papelera-vista');
  const { confirmar } = useAvisos();
  const [datos, setDatos] = useState<ContenidoPapelera>();
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccion, seleccionar] = useState<string[]>([]);
  const [ocupado, bloquear] = useState(false);
  const [error, setError] = useState('');
  const [fallos, setFallos] = useState<Record<string,string>>({});
  const [nombres, setNombres] = useState<Record<string,string>>({});
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => {
    try { setDatos(await consultarPapelera()); setError(''); }
    catch { setError('No se pudo cargar la papelera.'); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  const items = datos?.items ?? [];
  const elegidos = items.filter(i => seleccion.includes(i.id));
  async function aplicar(lista:EntradaPapelera[], restaurar:boolean) {
    if (!lista.length || ocupado) return;
    if (!restaurar && !await confirmar('¿Eliminar definitivamente?', `Se eliminarán los elementos seleccionados (${lista.length}) y su contenido. Esta acción no se puede deshacer.`, 'Eliminar definitivamente')) return;
    if (restaurar && lista.some(i=>i.destino_en_raiz) && !await confirmar('¿Restaurar en Mis archivos?', 'Algunas carpetas originales ya no están disponibles. Sus elementos se restaurarán en Mis archivos.', 'Restaurar')) return;
    bloquear(true);
    const errores: Record<string,string> = {};
    try {
      for (const item of lista) {
        try {
          if (restaurar) await restaurarEntrada(item,nombres[item.id]);
          else await purgarEntrada(item.id);
        } catch (e) { errores[item.id] = e instanceof Error ? e.message : 'No se pudo completar la operación.'; }
      }
      setFallos(errores);
      seleccionar(Object.keys(errores));
      setModoSeleccion(Object.keys(errores).length > 0);
      setMensaje(`${restaurar ? 'Restaurados' : 'Eliminados definitivamente'}: ${lista.length - Object.keys(errores).length}.`);
      await cargar();
      if (!restaurar) void actualizarConsumo().catch(() => {});
    } finally { bloquear(false); }
  }
  return <div className="dashboard-page archivos-page"><Sidebar />
    <main className="dashboard-content archivos-content papelera-page">
      <header className="papelera-encabezado"><div><h1 className="titulo-pagina">Papelera</h1>
        <p>Los elementos se eliminan definitivamente después de 30 días.</p></div>
        <div className="papelera-controles">
          {!!items.length && !modoSeleccion && <button className="archivo-button" onClick={() => setModoSeleccion(true)}>Seleccionar</button>}
        <SelectorVista vista={vista} cambiarVista={cambiarVista} etiqueta="Vista de la papelera" />
        </div></header>
      {datos && <p className="papelera-consumo"><Icon icon="lucide:hard-drive" aria-hidden="true" />
        <strong>{formatoBytes(Number(datos.bytes))} en la papelera</strong> · Incluidos en tu cuota</p>}
      {error && <p role="alert">{error} <button className="archivo-button" onClick={cargar}>Reintentar</button></p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!datos && !error && <p role="status">Cargando papelera…</p>}
      {datos && (items.length === 0 ? <section className="archivos-vacio"><div className="vacio-icon"><Icon icon="lucide:trash-2" /></div><h2>La papelera está vacía</h2></section> :
        <fieldset disabled={ocupado} className="papelera-contenido" aria-label="Elementos en la papelera">
          {modoSeleccion && <div className="archivos-lote">
            <strong aria-live="polite">{elegidos.length} en la selección</strong>
            <button className="archivo-button" onClick={() => seleccionar(elegidos.length === items.length ? [] : items.map(i => i.id))}>
              {elegidos.length === items.length ? 'Quitar selección' : 'Seleccionar todo'}
            </button>
            <button className="archivo-button" disabled={!elegidos.length} onClick={()=>aplicar(elegidos,true)}>Restaurar</button>
            <button className="archivo-button" disabled={!elegidos.length} onClick={()=>aplicar(elegidos,false)}>Eliminar definitivamente</button>
            <button className="archivo-button" onClick={() => { seleccionar([]); setModoSeleccion(false); }}>Cancelar</button>
          </div>}
          <div className={vista === 'tarjetas' ? 'papelera-tarjetas' : 'papelera-lista'}>
          {items.map(item=><article className="papelera-fila" key={item.id}>
            {vista === 'tarjetas' && item.archivo_id && item.tipo_mime &&
              <div className="papelera-previa" inert={modoSeleccion}><VistaPrevia permitirReintento={false} archivo={{
                id:item.archivo_id, nombre_original:item.nombre, tipo_mime:item.tipo_mime, tamanio_bytes:item.bytes,
              }}/></div>}
            {modoSeleccion && <button type="button" className="seleccion-tarjeta" aria-label={`Seleccionar ${item.nombre}`}
              aria-pressed={seleccion.includes(item.id)} onClick={() => seleccionar(lista =>
                lista.includes(item.id) ? lista.filter(id => id !== item.id) : [...lista,item.id])}>
              {seleccion.includes(item.id) && <span aria-hidden="true">✓</span>}
            </button>}
            <strong className="papelera-nombre"><Icon icon={item.tipo === 'archivo' ? 'lucide:file' : 'lucide:folder'} aria-hidden="true"/>{item.nombre}</strong>
            <span>{item.ubicacion} · {formatoBytes(Number(item.bytes))}</span>
            <span>Se elimina el <time dateTime={item.vence_en}>{fecha.format(new Date(item.vence_en))}</time></span>
            {fallos[item.id] && <div className="papelera-conflicto"><p role="alert">{fallos[item.id]}</p><label>Nombre al restaurar <input value={nombres[item.id] ?? item.nombre} onChange={e=>setNombres({...nombres,[item.id]:e.target.value})}/></label></div>}
          </article>)}
          </div>
        </fieldset>)}
    </main></div>;
}
