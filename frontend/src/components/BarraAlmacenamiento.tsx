import { formatoBytes, porcentajeAlmacenamiento, textoPorcentaje } from '../services/usagePolicy';
import type { Consumo } from '../services/consumo';
import './Avisos.css';

export default function BarraAlmacenamiento({ almacenamiento }: { almacenamiento: Consumo['almacenamiento'] }) {
  const porcentaje = porcentajeAlmacenamiento(almacenamiento.usados_bytes, almacenamiento.cuota_bytes);
  const texto = textoPorcentaje(porcentaje);
  return <div className="uso-almacenamiento">
    <div className="uso-etiqueta"><span>{formatoBytes(almacenamiento.usados_bytes)} / {formatoBytes(almacenamiento.cuota_bytes)} utilizados</span><strong>{texto}</strong></div>
    <div className="uso-barra" role="progressbar" aria-label="Almacenamiento utilizado" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.min(porcentaje, 100)} aria-valuetext={`${texto} utilizados`}>
      <div className="uso-relleno" style={{ width: `${Math.min(porcentaje, 100)}%`, minWidth: porcentaje > 0 ? '4px' : 0 }} />
    </div>
    {almacenamiento.reservados_bytes > 0 && <small>{formatoBytes(almacenamiento.reservados_bytes)} reservados para cargas en curso</small>}
  </div>;
}
