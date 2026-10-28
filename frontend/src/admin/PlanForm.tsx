import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarPlan, type PlanAdmin } from '../services/admin';
import { Marca } from './AdminLayout';
import toast from 'react-hot-toast';
export default function PlanForm({ plan }: { plan?: PlanAdmin }) {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  const [precio, setPrecio] = useState(String(plan?.precio_mensual ?? ''));
  const [gb, setGb] = useState(String(plan?.cuota_storage_gb ?? ''));
  const [limite, setLimite] = useState(String(plan?.limite_descargas ?? ''));
  const [ilimitadas, setIlimitadas] = useState(plan?.limite_descargas === null);
  const [publicas, setPublicas] = useState(plan?.permite_carpetas_publicas ?? false);
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  return <section className="admin-form-page"><Marca /><form className="admin-card" onSubmit={async e => {
    e.preventDefault(); setError('');
    if (!nombre.trim()) { setError('Escribe un nombre para el plan'); return; }
    if (plan && activo !== plan.activo && !window.confirm(`¿${activo ? 'Activar' : 'Desactivar'} este plan? Las suscripciones existentes se conservarán.`)) return;
    setGuardando(true);
    try {
      await guardarPlan({ nombre: nombre.trim(), precio_mensual: Number(precio), cuota_storage_gb: Number(gb), limite_descargas: ilimitadas ? null : Number(limite), permite_carpetas_publicas: publicas, activo }, plan?.id);
      toast.success(plan ? 'Plan actualizado' : 'Plan creado'); navigate('/admin/planes');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }}>
    <h1>{plan ? 'Editar plan' : 'Crear nuevo plan'}</h1><p>Completa la información del {plan ? 'plan' : 'nuevo plan'}</p>
    <fieldset disabled={guardando}>
      <label>Nombre del plan<input required maxLength={50} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Premium" /></label>
      <label>Precio mensual (Q)<input required type="number" min="0" max="99999999.99" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Q 0.00" /></label>
      <label>Almacenamiento (GB)<input required type="number" min="1" max="9007199" step="1" value={gb} onChange={e => setGb(e.target.value)} placeholder="20" /></label>
      <label>Límite de descargas<input required={!ilimitadas} disabled={ilimitadas} type="number" min="0" max="2147483647" step="1" value={limite} onChange={e => setLimite(e.target.value)} placeholder="20" /></label>
      <label className="admin-check"><input type="checkbox" checked={ilimitadas} onChange={e => setIlimitadas(e.target.checked)} />Descargas ilimitadas</label>
      <label className="admin-check"><input type="checkbox" checked={publicas} onChange={e => setPublicas(e.target.checked)} />Permitir carpetas públicas</label>
      <label className="admin-check"><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />Estado activo</label>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={() => navigate('/admin/planes')}>Cancelar</button><button type="submit">{guardando ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}</button></div>
    </fieldset>
  </form></section>;
}
