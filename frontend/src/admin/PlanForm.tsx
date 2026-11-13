import { formatPrecio } from '../planes/planesData';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mensajeEstadoPlan, guardarPlan, type PlanAdmin } from '../services/admin';
import { Marca } from './AdminLayout';
import { avisos as toast } from './avisos';
import Aviso from '../components/Aviso';
import AvisoInformativo from '../components/AvisoInformativo';
import { useAdministrador } from './contexto';
import { useConfirmar } from './confirmacionContexto';
import { ApiError } from '../services/auth';
export default function PlanForm({ plan, recargar }: { plan?: PlanAdmin; recargar?: () => void }) {
  const usuario = useAdministrador();
  const moneda = plan?.moneda ?? 'USD';
  const simbolo = moneda === 'USD' ? 'US$' : 'Q';
  const protegido = plan?.tiene_suscripciones === true;
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
  const precioHabitualValido = precio.trim() !== '' && Number.isFinite(Number(precio)) && Number(precio) > 0;
  const beneficioValido = Number.isFinite(precioFinal) && precioFinal >= 0 && precioFinal < Number(precio)
    && (tipoPromo !== 'PORCENTAJE' || (Number(porcentaje) > 0 && Number(porcentaje) <= 100))
    && (tipoPromo !== 'FIJO' || precioPromo.trim() !== '');
  return <section className="admin-form-page"><Marca /><form className="admin-card admin-plan-card" onSubmit={async e => {
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
    } catch (e) { setDesactualizado(e instanceof ApiError && (['PLAN_DESACTUALIZADO','PLAN_ARCHIVADO'].includes(e.code ?? '') || e.status === 404)); setError(e instanceof Error ? e.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }}>
    <h1 className="titulo-pagina">{plan ? protegido ? 'Gestionar plan' : 'Editar plan' : 'Crear nuevo plan'}</h1><p>{protegido ? plan?.nombre === 'Free' ? 'Consulta las condiciones protegidas del plan Free.' : 'Gestiona las promociones y el estado del plan.' : `Completa la información del ${plan ? 'plan' : 'nuevo plan'}`}</p>
    <fieldset disabled={guardando}>
      {protegido && <AvisoInformativo cuenta={usuario.id} id="plan-condiciones-protegidas">{plan?.nombre === 'Free'
        ? 'Este plan ya tiene contrataciones. Su nombre, precio, almacenamiento, descargas y carpetas públicas están protegidos para conservar lo contratado. Free debe mantenerse activo y no admite promociones. Para ofrecer beneficios distintos, crea un nuevo plan.'
        : 'Este plan ya tiene contrataciones. Su nombre, precio, almacenamiento, descargas y carpetas públicas están protegidos para conservar lo contratado. Puedes gestionar promociones y su estado. Para cambiar almacenamiento o descargas, crea un nuevo plan y desactiva este cuando corresponda.'}</AvisoInformativo>}
      <label>Nombre del plan<input required disabled={protegido || plan?.nombre === 'Free'} maxLength={50} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Premium" /></label>
      <label>Precio mensual ({moneda})<input required disabled={protegido || plan?.nombre === 'Free'} type="number" min={plan?.nombre === 'Free' || (plan && Number(plan.precio_mensual) === 0 && !activo) ? '0' : '0.01'} max="99999999.99" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder={`${simbolo} 0.00`} /></label>
      <p className="admin-ayuda admin-plan-ayuda-precio">Precio habitual para las renovaciones. Puedes ofrecer un descuento o un período gratis sin cambiarlo.</p>
      {plan?.nombre !== 'Free' && <>
        <label className="admin-check"><input type="checkbox" checked={promocion} onChange={e => setPromocion(e.target.checked)} />Promoción temporal</label>
        {promocion && <div className="admin-promocion">
          <fieldset className="promo-tipos" aria-describedby="promo-tipos-ayuda">
            <legend>1. Elige el tipo de promoción</legend>
            <p id="promo-tipos-ayuda" className="admin-ayuda">Selecciona una sola opción. Cada una cambia cómo se calcula el primer período.</p>
            <div className="promo-opciones">
              {([
                ['FIJO', simbolo, 'Precio fijo', 'Tú decides cuánto pagará.', `Ejemplo: primer período a ${simbolo}1.00`],
                ['PORCENTAJE', '%', 'Porcentaje de descuento', 'Descuenta una parte del precio habitual.', `Ejemplo: 25 % de ${simbolo}4.00 → ${simbolo}3.00`],
                ['GRATIS', '0', 'Período gratis', `El primer período cuesta ${simbolo}0.`, 'Después, precio habitual si renueva'],
              ] as const).map(([tipo, simbolo, titulo, descripcion, ejemplo]) => <label className="promo-opcion" key={tipo}>
                <input type="radio" name="tipo-promocion" aria-label={titulo} value={tipo} checked={tipoPromo === tipo} onChange={() => setTipoPromo(tipo)} />
                <span className="promo-simbolo" aria-hidden="true">{simbolo}</span>
                <span className="promo-opcion-texto"><strong>{titulo}</strong><span>{descripcion}</span><small>{ejemplo}</small></span>
              </label>)}
            </div>
          </fieldset>
          <section className="promo-beneficio" aria-labelledby="promo-beneficio-titulo">
            <h2 id="promo-beneficio-titulo">2. {tipoPromo === 'GRATIS' ? 'Revisa el beneficio' : 'Define el beneficio'}</h2>
            {tipoPromo === 'FIJO' && <label>Precio promocional ({moneda})<input required type="number" min="0" max={Math.max(0, Number(precio) - .01)} step="0.01" value={precioPromo} onChange={e => setPrecioPromo(e.target.value)} /></label>}
            {tipoPromo === 'PORCENTAJE' && <label>Descuento (%)<input required type="number" min="0.01" max="100" step="0.01" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} /></label>}
            {tipoPromo === 'GRATIS' && <p className="admin-ayuda">No necesitas indicar un importe: el primer período mensual completo será gratis.</p>}
          </section>
          <section className="promo-resumen admin-promocion-previa" aria-label="Vista previa de la promoción" aria-live="polite">
            <span className="promo-resumen-etiqueta">ASÍ LO VERÁ EL CLIENTE</span>
            {!precioHabitualValido ? <p>Escribe el precio mensual habitual para calcular la promoción.</p> : !beneficioValido ? <p>Indica un beneficio válido que reduzca el precio habitual.</p> : <div className="promo-precios">
              <div><span>Primer período</span><strong>{formatPrecio(precioFinal, moneda)}</strong><small>{tipoPromo === 'PORCENTAJE' ? `${Number(porcentaje)} % de descuento` : tipoPromo === 'GRATIS' ? 'Un período mensual gratis' : 'Precio promocional fijo'}</small></div>
              <div><span>Renovaciones</span><strong>{formatPrecio(Number(precio), moneda)}</strong><small>Por mes, solo si acepta renovar</small></div>
            </div>}
          </section>
          <section className="promo-vigencia" aria-labelledby="promo-vigencia-titulo">
            <h2 id="promo-vigencia-titulo">3. Define cuándo estará disponible</h2>
            <div className="promo-fechas">
              <label>Inicio de promoción (Guatemala)<input required type="datetime-local" value={inicioPromo} onChange={e => setInicioPromo(e.target.value)} /></label>
              <label>Fin de promoción (Guatemala)<input required type="datetime-local" min={inicioPromo} value={finPromo} onChange={e => setFinPromo(e.target.value)} /></label>
            </div>
          </section>
          <AvisoInformativo cuenta={usuario.id} id="promociones-primer-periodo">El precio promocional cubre un período mensual completo. La siguiente renovación automática será al precio habitual, solo si el cliente la acepta.</AvisoInformativo>
        </div>}
      </>}
      <label>Almacenamiento (GB)<input required disabled={protegido} type="number" min="1" max="9007199" step="1" value={gb} onChange={e => setGb(e.target.value)} placeholder="20" /></label>
      <label>Límite de descargas<input required={!ilimitadas} disabled={protegido || ilimitadas} type="number" min="0" max="2147483647" step="1" value={limite} onChange={e => setLimite(e.target.value)} placeholder="20" /></label>
      <label className="admin-check"><input type="checkbox" disabled={protegido} checked={ilimitadas} onChange={e => setIlimitadas(e.target.checked)} />Descargas ilimitadas</label>
      <label className="admin-check"><input type="checkbox" disabled={protegido} checked={publicas} onChange={e => setPublicas(e.target.checked)} />Permitir carpetas públicas</label>
      <label className="admin-check"><input type="checkbox" disabled={plan?.nombre === 'Free'} checked={activo} onChange={e => setActivo(e.target.checked)} />Estado activo</label>
      {error && <Aviso variante={desactualizado ? 'advertencia' : 'error'}>{error}{desactualizado && <button type="button" className="admin-secondary" onClick={recargar}>Recargar plan</button>}</Aviso>}
      <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={() => navigate('/admin/planes')}>Cancelar</button><button type="submit" disabled={desactualizado}>{guardando ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}</button></div>
    </fieldset>
  </form></section>;
}
