import AvisoPlanRetirado from '../components/AvisoPlanRetirado';
import { useEffect, useState } from "react";
import Icon from '../components/IconoAviso';
import { useNavigate } from "react-router-dom";
import { avisosCliente as toast } from '../cuenta/avisos';
import { obtenerCatalogo, useConsumo } from "../services/consumo";
import Sidebar from "../components/Sidebar";
import { configurarRenovacion, obtenerPlanActual, type PlanActual } from "../services/pagos";
import { formatPrecio, textoDescargas, type Plan } from "./planesData";
import "../dashboard/Dashboard.css";
import "./Planes.css";
import "./Renovacion.css";

function Planes() {
  const { consumo } = useConsumo();
  const retirado = consumo?.suscripcion?.plan_retirado === true;
  const navigate = useNavigate();
  const [actual, setActual] = useState<PlanActual | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cargarCatalogo = () => {
    setCargando(true);
    setError('');
    obtenerCatalogo().then(setPlanes).catch(e => setError(e.message)).finally(() => setCargando(false));
  };
  useEffect(() => {
    obtenerPlanActual().then(setActual).catch(e => toast.error(e.message));
    obtenerCatalogo().then(setPlanes).catch(e => setError(e.message)).finally(() => setCargando(false));
  }, []);
  const planActual = planes.find(plan => plan.id === actual?.planId);
  const cambiarRenovacion = async () => {
    if (!actual) return;
    const renovar = !actual.renovacionAutomatica;
    setGuardando(true);
    try {
      await configurarRenovacion(renovar);
      setActual(await obtenerPlanActual());
      toast.success(renovar ? 'Renovación automática activada' : 'Renovación automática desactivada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la renovación.');
    } finally { setGuardando(false); }
  };

  return (
    <div className="dashboard-page planes-page">
      <Sidebar />
      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="titulo-pagina">Planes y almacenamiento</h1>
            <p className="planes-subtitle">Más espacio para tus archivos, un plan a tu medida.</p>
          </div>
          <button type="button" className="planes-history" onClick={() => navigate('/planes/historial')}>
            <Icon icon="lucide:receipt-text" aria-hidden="true" /> Historial de pagos
          </button>
        </div>

        <AvisoPlanRetirado />
        {planActual && actual && <section className="planes-membership" aria-label="Tu suscripción">
          <span className="planes-membership-icon"><Icon icon="lucide:hard-drive" aria-hidden="true" /></span>
          <div className="planes-membership-name"><span>Tu plan actual</span><strong>{planActual.nombre}</strong></div>
          <div className="planes-membership-detail"><span>Almacenamiento</span><strong>{planActual.almacenamientoGb} GB</strong></div>
          <div className="planes-membership-detail"><span>{actual.venceEl ? 'Vence el' : 'Fin del ciclo'}</span><strong>{actual.venceEl ?? actual.renovacion}</strong></div>
          <span className="planes-status"><Icon icon="lucide:check" aria-hidden="true" /> Plan actual</span>
        </section>}

        {!retirado && planActual && actual?.venceEl && <section className="planes-renovacion" aria-label="Renovación del plan">
          <div>
            <strong>{actual.renovacionAutomatica ? 'Renovación automática activada' : 'Renovación automática desactivada'}</strong>
            <span>{actual.renovacionAutomatica ? `Tu plan se renovará el ${actual.venceEl} por ${formatPrecio(planActual.precioHabitual ?? planActual.precio)} con un pago simulado.` : `Si no lo renuevas, el ${actual.venceEl} volverás al plan Free. La renovación cuesta ${formatPrecio(planActual.precioHabitual ?? planActual.precio)} / mes.`}</span>
          </div>
          <button type="button" className="planes-history" disabled={guardando} onClick={() => void cambiarRenovacion()}>
            {actual.renovacionAutomatica ? 'No renovar' : 'Renovar automáticamente'}
          </button>
        </section>}

        <div id="catalogo" className="planes-section-heading"><h2 className="titulo-seccion">Encuentra tu próximo espacio</h2><p>Compara almacenamiento y descargas mensuales.</p></div>
        {cargando ? <p className="planes-state" role="status">Cargando planes…</p> : error ?
          <div className="planes-state" role="alert"><p>{error}</p><button className="planes-history" onClick={cargarCatalogo}>Reintentar</button></div> :
          planes.length === 0 ? <p className="planes-state">No hay planes disponibles en este momento.</p> :
          <section className="plans-grid" aria-label="Planes disponibles">
            {planes.map(plan => {
              const esActual = actual?.planId === plan.id;
              return <article key={plan.id} className={`plan-card${esActual ? ' current' : ''}`}>
                <div className="plan-card-heading"><h2 className="plan-name">{plan.nombre}</h2>{esActual && <span className="plan-badge">Tu plan</span>}</div>
                <div className="plan-price"><strong>{formatPrecio(plan.precio)}</strong><span>/ mes</span></div>
                {plan.promocionHasta && <p className="planes-subtitle">Promoción: un período mensual a este precio. Después, {formatPrecio(plan.precioHabitual!)} / mes si aceptas renovar. Disponible hasta {new Date(plan.promocionHasta).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' })}.</p>}
                <p className="plan-caption">{plan.precio === 0 ? 'Un espacio para comenzar.' : 'Espacio para seguir creando.'}</p>
                <ul className="plan-features">
                  <li><span className="plan-feature-icon"><Icon icon="lucide:hard-drive" aria-hidden="true" /></span><div><strong>{plan.almacenamientoGb} GB</strong><span>de almacenamiento</span></div></li>
                  <li><span className="plan-feature-icon"><Icon icon="lucide:download" aria-hidden="true" /></span><div><strong>{textoDescargas(plan)}</strong><span>{plan.descargasMensuales === null ? 'Descargas sin límite mensual' : 'Desde la biblioteca pública'}</span></div></li>
                </ul>
                <button type="button" className={`plan-button${esActual ? ' current' : ''}`} disabled={esActual} onClick={() => navigate(`/planes/contratar?plan=${plan.id}`)}>
                  {esActual ? 'Plan Actual' : plan.precio === 0 && plan.promocionHasta ? 'Activar plan gratis' : 'Contratar Plan'}<Icon icon={esActual ? 'lucide:check' : 'lucide:arrow-right'} aria-hidden="true" />
                </button>
                {esActual && actual && <span className="plan-renewal">{actual.venceEl ? 'Vence el' : 'Fin del ciclo'}: {actual.venceEl ?? actual.renovacion}</span>}
              </article>;
            })}
          </section>}
      </main>
    </div>
  );
}
export default Planes;
