import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from './AdminIcon';
import toast from 'react-hot-toast';
import { guardarPlan, listarPlanes } from '../services/admin';
import { useListado } from './useListado';
import PlanForm from './PlanForm';
export default function PlanesAdmin({ editar = false }: { editar?: boolean }) {
  const { id } = useParams();
  const { datos: planes, cargando, error, cargar } = useListado(listarPlanes);
  const [ocupado, setOcupado] = useState(false);
  if (cargando) return <p role="status">Cargando planes…</p>;
  if (error) return <div role="alert" className="admin-error">{error} <button onClick={() => void cargar()}>Reintentar</button></div>;
  if (editar) {
    const plan = planes.find(p => p.id === Number(id));
    return plan ? <PlanForm key={plan.id} plan={plan} /> : <p role="alert">Plan no encontrado. <Link to="/admin/planes">Volver</Link></p>;
  }
  return <section><header className="admin-heading"><h1>Planes y facturación</h1><Link className="admin-button" to="/admin/planes/nuevo"><Icon icon="lucide:plus" />Crear nuevo plan</Link></header>
    <p className="admin-intro">Gestiona los planes de suscripción disponibles en Vaultly</p><h2>Planes actuales</h2>
    {!planes.length ? <p>No hay planes. Crea el primer plan para comenzar.</p> : <div className="admin-table-scroll" tabIndex={0} aria-label="Planes actuales"><table><thead><tr>{['Plan', 'Precio', 'Almacenamiento', 'Descargas', 'Estado', 'Acciones'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{planes.map(p => <tr key={p.id}>
      <td>{p.nombre}</td><td>Q{Number(p.precio_mensual).toFixed(2)}</td><td>{p.cuota_storage_gb} GB</td><td>{p.limite_descargas === null ? 'Ilimitadas' : p.limite_descargas}</td><td><span className={`admin-badge ${p.activo ? '' : 'inactivo'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td className="admin-row-actions"><Link aria-label={`Editar ${p.nombre}`} title="Editar plan" to={`/admin/planes/${p.id}/editar`}><Icon icon="lucide:pencil" /></Link><button disabled={ocupado} aria-label={`${p.activo ? 'Desactivar' : 'Activar'} ${p.nombre}`} title="Cambiar estado" onClick={async () => {
        if (!window.confirm(`¿${p.activo ? 'Desactivar' : 'Activar'} el plan ${p.nombre}? Las suscripciones existentes se conservarán.`)) return;
        setOcupado(true);
        try { await guardarPlan({ ...p, precio_mensual: Number(p.precio_mensual), activo: !p.activo }, p.id); toast.success('Estado actualizado'); await cargar(); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado'); } finally { setOcupado(false); }
      }}><Icon icon="lucide:arrow-right-left" /></button></td>
    </tr>)}</tbody></table></div>}
  </section>;
}
