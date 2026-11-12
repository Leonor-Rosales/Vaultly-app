import type { Pago, EstadoPago, MetodoPago, DatosComprobante } from './pagos';
import type { Plan } from '../planes/planesData';

// Contratos externos: los servicios HTTP los convierten antes de entregar datos a las vistas.
type MetodoApi = MetodoPago | "transferencia";
// Respuesta del backend (/api/planes/pagos y /api/planes/contratar)
export interface PagoApi {
  comprobante?: DatosComprobante | null;
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
  comprobante: p.comprobante ?? null,
  fechaISO: p.fecha,
  id: p.id,
  fecha: formatoFecha(p.fecha),
  codigo: p.codigo,
  plan: p.plan,
  monto: p.monto,
  metodo: p.monto === 0 && p.comprobante?.promocion ? 'Activación sin cobro' : NOMBRE_METODO[p.metodo] ?? p.metodo,
  estado: p.estado,
});

export interface PlanApi {
  precio_vigente?: number;
  promocion_vigente?: boolean;
  promocion_fin?: string | null;
  version: number;
  id: number;
  nombre: string;
  cuota_storage_gb: number;
  precio_mensual: string;
  limite_descargas: number | null;
}

export function adaptarPlan(p: PlanApi): Plan {
  return {
    version: p.version,
    id: String(p.id),
    nombre: p.nombre,
    precio: Number(p.precio_vigente ?? p.precio_mensual),
    ...(p.promocion_vigente && p.promocion_fin ? { precioHabitual: Number(p.precio_mensual), promocionHasta: p.promocion_fin } : {}),
    almacenamientoGb: p.cuota_storage_gb,
    descargasMensuales: p.limite_descargas,
  };
}
