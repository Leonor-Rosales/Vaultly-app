import { actualizarConsumo } from "./consumo";

export type MetodoPago = "tarjeta" | "transferencia";
export type EstadoPago = "Completado" | "Pendiente";

export interface Pago {
  id: string;
  fecha: string; // dd/mm/aaaa
  codigo: string;
  plan: string;
  monto: number;
  metodo: string;
  estado: EstadoPago;
}

export interface PlanActual {
  planId: string;
  renovacion: string; // dd/mm/aaaa
}

export interface ContratarPlanData {
  planId: string;
  metodo: MetodoPago;
}

// Pantallas conservadas; cobros, contratación e historial real quedan pendientes.
export const obtenerHistorial = async (): Promise<Pago[]> => [];
export const obtenerPlanActual = async (): Promise<PlanActual> => {
  const consumo = await actualizarConsumo();
  if (!consumo) throw new Error('No se pudo consultar tu plan.');
  return { planId: String(consumo.plan.id), renovacion: new Date(consumo.descargas.fin).toLocaleDateString('es-GT', { timeZone: 'UTC' }) };
};
export const contratarPlan = async (_data: ContratarPlanData): Promise<Pago> => {
  throw new Error('La contratación de planes todavía no está disponible. No se realizó ningún cobro.');
};
