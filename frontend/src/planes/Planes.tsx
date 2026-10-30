import { useEffect, useState } from "react";
import Icon from '../components/IconoAviso';
import { useNavigate } from "react-router-dom";
import { avisosCliente as toast } from '../cuenta/avisos';
import { obtenerCatalogo } from "../services/consumo";
import Sidebar from "../components/Sidebar";
import { obtenerPlanActual, type PlanActual } from "../services/pagos";
import { formatPrecio, textoDescargas, type Plan } from "./planesData";
import "../dashboard/Dashboard.css";
import "./Planes.css";

function Planes() {
  const navigate = useNavigate();
  const [actual, setActual] = useState<PlanActual | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
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

  return (
    <div className="dashboard-page planes-page">
      <Sidebar />
      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1>Planes y almacenamiento</h1>
            <p className="planes-subtitle">Más espacio para tus archivos, un plan a tu medida.</p>
          </div>
          <button type="button" className="planes-history" onClick={() => navigate('/planes/historial')}>
            <Icon icon="lucide:receipt-text" aria-hidden="true" /> Historial de pagos
          </button>
        </div>

        {planActual && actual && <section className="planes-membership" aria-label="Tu suscripción">
          <span className="planes-membership-icon"><Icon icon="lucide:hard-drive" aria-hidden="true" /></span>
          <div className="planes-membership-name"><span>Tu plan actual</span><strong>{planActual.nombre}</strong></div>
          <div className="planes-membership-detail"><span>Almacenamiento</span><strong>{planActual.almacenamientoGb} GB</strong></div>
          <div className="planes-membership-detail"><span>Fin del ciclo</span><strong>{actual.renovacion}</strong></div>
          <span className="planes-status"><Icon icon="lucide:check" aria-hidden="true" /> Plan actual</span>
        </section>}

        <div className="planes-section-heading"><h2>Encuentra tu próximo espacio</h2><p>Compara almacenamiento y descargas mensuales.</p></div>
        {cargando ? <p className="planes-state" role="status">Cargando planes…</p> : error ?
          <div className="planes-state" role="alert"><p>{error}</p><button className="planes-history" onClick={cargarCatalogo}>Reintentar</button></div> :
          planes.length === 0 ? <p className="planes-state">No hay planes disponibles en este momento.</p> :
          <section className="plans-grid" aria-label="Planes disponibles">
            {planes.map(plan => {
              const esActual = actual?.planId === plan.id;
              return <article key={plan.id} className={`plan-card${esActual ? ' current' : ''}`}>
                <div className="plan-card-heading"><h2 className="plan-name">{plan.nombre}</h2>{esActual && <span className="plan-badge">Tu plan</span>}</div>
                <div className="plan-price"><strong>{formatPrecio(plan.precio)}</strong><span>/ mes</span></div>
                <p className="plan-caption">{plan.precio === 0 ? 'Un espacio para comenzar.' : 'Espacio para seguir creando.'}</p>
                <ul className="plan-features">
                  <li><span className="plan-feature-icon"><Icon icon="lucide:hard-drive" aria-hidden="true" /></span><div><strong>{plan.almacenamientoGb} GB</strong><span>de almacenamiento</span></div></li>
                  <li><span className="plan-feature-icon"><Icon icon="lucide:download" aria-hidden="true" /></span><div><strong>{textoDescargas(plan)}</strong><span>{plan.descargasMensuales === null ? 'Descargas sin límite mensual' : 'Desde la biblioteca pública'}</span></div></li>
                </ul>
                <button type="button" className={`plan-button${esActual ? ' current' : ''}`} disabled={esActual} onClick={() => navigate(`/planes/contratar?plan=${plan.id}`)}>
                  {esActual ? 'Plan Actual' : 'Contratar Plan'}<Icon icon={esActual ? 'lucide:check' : 'lucide:arrow-right'} aria-hidden="true" />
                </button>
                {esActual && actual && <span className="plan-renewal">Fin del ciclo: {actual.renovacion}</span>}
              </article>;
            })}
          </section>}
      </main>
    </div>
  );
}
export default Planes;
