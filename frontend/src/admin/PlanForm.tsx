import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mensajeEstadoPlan, guardarPlan, type PlanAdmin } from '../services/admin';
import { Marca } from './AdminLayout';
import { avisos as toast } from './avisos';
import Aviso from '../components/Aviso';
import { useConfirmar } from './confirmacionContexto';
import { ApiError } from '../services/auth';
export default function PlanForm({ plan, recargar }: { plan?: PlanAdmin; recargar?: () => void }) {
  const confirmar = useConfirmar();
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
  const [desactualizado, setDesactualizado] = useState(false);
  const aLocal = (iso?: string | null) => iso ? new Date(new Date(iso).getTime() - 6 * 3600000).toISOString().slice(0, 16) : '';
  const [promocion, setPromocion] = useState(plan?.promocion_precio != null);
  const [precioPromo, setPrecioPromo] = useState(String(plan?.promocion_precio ?? 0));
  const [tipoPromo, setTipoPromo] = useState<'FIJO' | 'PORCENTAJE' | 'GRATIS'>(plan?.promocion_tipo ?? (plan?.promocion_precio != null && Number(plan.promocion_precio) === 0 ? 'GRATIS' : 'FIJO'));
  const [porcentaje, setPorcentaje] = useState(String(plan?.promocion_porcentaje ?? 25));
  const precioFinal = tipoPromo === 'GRATIS' ? 0 : tipoPromo === 'PORCENTAJE'
    ? Math.round(Math.round(Number(precio) * 100) * (10000 - Math.round(Number(porcentaje) * 100)) / 10000) / 100 : Number(precioPromo);
  const [inicioPromo, setInicioPromo] = useState(aLocal(plan?.promocion_inicio));
  const [finPromo, setFinPromo] = useState(aLocal(plan?.promocion_fin));
  return <section className="admin-form-page"><Marca /><form className="admin-card" onSubmit={async e => {
    e.preventDefault(); setError('');
    if (!nombre.trim()) { setError('Escribe un nombre para el plan'); return; }
    if (plan && activo !== plan.activo && !(await confirmar(mensajeEstadoPlan(plan)))) return;
    setGuardando(true);
    try {
      await guardarPlan({ version: plan?.version, nombre: nombre.trim(), precio_mensual: Number(precio), cuota_storage_gb: Number(gb), limite_descargas: ilimitadas ? null : Number(limite), permite_carpetas_publicas: publicas, activo,
        promocion_precio: promocion ? precioFinal : null,
        promocion_tipo: promocion ? tipoPromo : null,
        promocion_porcentaje: promocion && tipoPromo === 'PORCENTAJE' ? Number(porcentaje) : null,
        promocion_inicio: promocion ? new Date(`${inicioPromo}:00-06:00`).toISOString() : null,
        promocion_fin: promocion ? new Date(`${finPromo}:00-06:00`).toISOString() : null,
      }, plan?.id);
      toast.success(plan ? 'Plan actualizado' : 'Plan creado'); navigate('/admin/planes');
    } catch (e) { setDesactualizado(e instanceof ApiError && e.code === 'PLAN_DESACTUALIZADO'); setError(e instanceof Error ? e.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }}>
    <h1 className="titulo-pagina">{plan ? 'Editar plan' : 'Crear nuevo plan'}</h1><p>Completa la información del {plan ? 'plan' : 'nuevo plan'}</p>
    <fieldset disabled={guardando}>
      <label>Nombre del plan<input required maxLength={50} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Premium" /></label>
      <label>Precio mensual (Q)<input required type="number" min={plan?.nombre === 'Free' || (plan && Number(plan.precio_mensual) === 0 && !activo) ? '0' : '0.01'} max="99999999.99" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Q 0.00" /></label>
      <p className="admin-ayuda">Precio habitual para las renovaciones. Para ofrecerlo gratis temporalmente, configura una promoción a Q0.00.</p>
      {plan?.nombre !== 'Free' && <>
        <label className="admin-check"><input type="checkbox" checked={promocion} onChange={e => setPromocion(e.target.checked)} />Promoción temporal</label>
        {promocion && <div className="admin-promocion">
          <label>Tipo de promoción<select aria-label="Tipo de promoción" value={tipoPromo} onChange={e => setTipoPromo(e.target.value as typeof tipoPromo)}><option value="FIJO">Precio promocional fijo</option><option value="PORCENTAJE">Porcentaje de descuento</option><option value="GRATIS">Período gratis</option></select></label>
          {tipoPromo === 'FIJO' && <label>Precio promocional (Q)<input required type="number" min="0" max={Math.max(0, Number(precio) - .01)} step="0.01" value={precioPromo} onChange={e => setPrecioPromo(e.target.value)} /></label>}
          {tipoPromo === 'PORCENTAJE' && <label>Descuento (%)<input required type="number" min="0.01" max="100" step="0.01" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} /></label>}
          <p className="admin-ayuda admin-promocion-previa">Precio final del primer período: <strong>{Number.isFinite(precioFinal) && precioFinal >= 0 ? `Q${precioFinal.toFixed(2)}` : '—'}</strong>. Después, precio habitual: Q{Number(precio || 0).toFixed(2)} / mes.</p>
          <label>Inicio de promoción (Guatemala)<input required type="datetime-local" value={inicioPromo} onChange={e => setInicioPromo(e.target.value)} /></label>
          <label>Fin de promoción (Guatemala)<input required type="datetime-local" min={inicioPromo} value={finPromo} onChange={e => setFinPromo(e.target.value)} /></label>
          <Aviso variante="informacion">El precio promocional cubre un período mensual completo. La siguiente renovación automática será al precio habitual, solo si el cliente la acepta.</Aviso>
        </div>}
      </>}
      <label>Almacenamiento (GB)<input required type="number" min="1" max="9007199" step="1" value={gb} onChange={e => setGb(e.target.value)} placeholder="20" /></label>
      <label>Límite de descargas<input required={!ilimitadas} disabled={ilimitadas} type="number" min="0" max="2147483647" step="1" value={limite} onChange={e => setLimite(e.target.value)} placeholder="20" /></label>
      <label className="admin-check"><input type="checkbox" checked={ilimitadas} onChange={e => setIlimitadas(e.target.checked)} />Descargas ilimitadas</label>
      <label className="admin-check"><input type="checkbox" checked={publicas} onChange={e => setPublicas(e.target.checked)} />Permitir carpetas públicas</label>
      <label className="admin-check"><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />Estado activo</label>
      {error && <Aviso variante={desactualizado ? 'advertencia' : 'error'}>{error}{desactualizado && <button type="button" className="admin-secondary" onClick={recargar}>Recargar plan</button>}</Aviso>}
      <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={() => navigate('/admin/planes')}>Cancelar</button><button type="submit" disabled={desactualizado}>{guardando ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}</button></div>
    </fieldset>
  </form></section>;
}
