import { Link } from 'react-router-dom';
import { useConsumo } from '../services/consumo';
import Icon from './IconoAviso';
import './AvisoPlanRetirado.css';

export default function AvisoPlanRetirado() {
  const { consumo } = useConsumo();
  const suscripcion = consumo?.suscripcion;
  if (!consumo || !suscripcion?.plan_retirado) return null;
  const fechaFin = new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala',
  }).format(new Date(suscripcion.fecha_fin));
  return <section className="plan-retirado" role="status">
    <Icon icon="lucide:receipt-text" /><div>
      <h2>Tu plan {consumo.plan.nombre} dejará de estar disponible</h2>
      <p>Tu plan cambia a Free el {fechaFin} (Guatemala), sin otro cobro. Tus archivos se conservan.</p>

    </div><Link className="plan-retirado-enlace" to="/planes#catalogo">Ver planes disponibles</Link>
  </section>;
}
