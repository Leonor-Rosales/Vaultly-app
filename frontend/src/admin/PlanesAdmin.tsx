import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from './AdminIcon';
import { avisos as toast } from './avisos';
import Aviso from '../components/Aviso';
import { useConfirmar } from './confirmacionContexto';
import { mensajeEstadoPlan, guardarPlan, listarPlanes } from '../services/admin';
import { useListado } from './useListado';
import PlanForm from './PlanForm';
import { ApiError } from '../services/auth';
export default function PlanesAdmin({ editar = false }: { editar?: boolean }) {
  const confirmar = useConfirmar();
  const { id } = useParams();
  const { datos: planes, cargando, error, cargar } = useListado(listarPlanes);
  const [ocupado, setOcupado] = useState(false);
  const [conflicto, setConflicto] = useState('');
  if (cargando) return <p role="status">Cargando planes…</p>;
  if (error) return <Aviso variante="error">{error} <button onClick={() => void cargar()}>Reintentar</button></Aviso>;
  if (editar) {
    const plan = planes.find(p => p.id === Number(id));
    return plan ? <PlanForm key={`${plan.id}:${plan.version}`} plan={plan} recargar={cargar} /> : <p role="alert">Plan no encontrado. <Link to="/admin/planes">Volver</Link></p>;
  }
  return <section className="admin-list-page"><header className="admin-heading"><div><h1 className="titulo-pagina">Planes y facturación</h1><p className="admin-intro">Gestiona los planes de suscripción disponibles en Vaultly</p></div><Link className="admin-button" to="/admin/planes/nuevo"><Icon icon="lucide:plus" />Crear nuevo plan</Link></header>
    <h2 className="titulo-seccion">Planes actuales</h2>
    {conflicto && <Aviso variante="advertencia">{conflicto}<button type="button" className="admin-secondary" onClick={() => { setConflicto(''); cargar(); }}>Actualizar planes</button></Aviso>}
    {!planes.length ? <p>No hay planes. Crea el primer plan para comenzar.</p> : <div className="admin-table-scroll" tabIndex={0} aria-label="Planes actuales"><table><thead><tr>{['Plan', 'Precio', 'Almacenamiento', 'Descargas', 'Estado', 'Acciones'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{planes.map(p => <tr key={p.id}>
      <td>{p.nombre}</td><td>Q{Number(p.precio_mensual).toFixed(2)}{p.promocion_precio != null && <small className="admin-promocion-resumen">Promoción: Q{Number(p.promocion_precio).toFixed(2)}<br />{new Date(p.promocion_inicio!).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' })} – {new Date(p.promocion_fin!).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' })}</small>}</td><td>{p.cuota_storage_gb} GB</td><td>{p.limite_descargas === null ? 'Ilimitadas' : p.limite_descargas}</td><td><span className={`admin-badge ${p.activo ? '' : 'inactivo'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td className="admin-row-actions"><Link aria-label={`Editar ${p.nombre}`} title="Editar plan" to={`/admin/planes/${p.id}/editar`}><Icon icon="lucide:pencil" /></Link><button disabled={ocupado} aria-label={`${p.activo ? 'Desactivar' : 'Activar'} ${p.nombre}`} title="Cambiar estado" onClick={async () => {
        if (!(await confirmar(mensajeEstadoPlan(p)))) return;
        setOcupado(true);
        try { await guardarPlan({ ...p, precio_mensual: Number(p.precio_mensual), activo: !p.activo }, p.id); toast.success('Estado actualizado'); await cargar(); }
        catch (e) { if (e instanceof ApiError && e.code === 'PLAN_DESACTUALIZADO') setConflicto(e.message); else toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado'); } finally { setOcupado(false); }
      }}><Icon icon="lucide:arrow-right-left" /></button></td>
    </tr>)}</tbody></table></div>}
  </section>;
}
