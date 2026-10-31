import type { Pago, EstadoPago, MetodoPago } from './pagos';
import type { Plan } from '../planes/planesData';

// Contratos externos: los servicios HTTP los convierten antes de entregar datos a las vistas.
type MetodoApi = MetodoPago | "transferencia";
// Respuesta del backend (/api/planes/pagos y /api/planes/contratar)
export interface PagoApi {
  id: string;
  fecha: string; // ISO
  codigo: string;
  plan: string;
  monto: number;
  metodo: MetodoApi;
  estado: EstadoPago;
}

const NOMBRE_METODO: Record<MetodoApi, string> = {
  tarjeta: "Tarjeta simulada",
  transferencia: "Transferencia simulada",
};

const formatoFecha = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export const adaptarPago = (p: PagoApi): Pago => ({
  id: p.id,
  fecha: formatoFecha(p.fecha),
  codigo: p.codigo,
  plan: p.plan,
  monto: p.monto,
  metodo: NOMBRE_METODO[p.metodo] ?? p.metodo,
  estado: p.estado,
});

export interface PlanApi {
  id: number;
  nombre: string;
  cuota_storage_gb: number;
  precio_mensual: string;
  limite_descargas: number | null;
}

export function adaptarPlan(p: PlanApi): Plan {
  return {
    id: String(p.id),
    nombre: p.nombre,
    precio: Number(p.precio_mensual),
    almacenamientoGb: p.cuota_storage_gb,
    descargasMensuales: p.limite_descargas,
  };
}
