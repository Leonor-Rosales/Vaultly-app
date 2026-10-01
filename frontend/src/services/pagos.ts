import { getPlan } from "../planes/planesData";

// Servicio de pagos SIMULADO. Guarda todo en memoria (se pierde al recargar la
// página). Cuando el backend tenga los endpoints de planes y pagos, solo hay
// que reemplazar el cuerpo de estas funciones por llamadas fetch; las pantallas
// no cambian porque ya las usan como funciones async.

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

const METODO_TEXTO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta simulada",
  transferencia: "Transferencia simulada",
};

let pagos: Pago[] = [
  { id: "1", fecha: "11/09/2026", codigo: "TX-89A456D", plan: "Pro Developer", monto: 150, metodo: "Tarjeta simulada", estado: "Completado" },
  { id: "2", fecha: "11/08/2026", codigo: "TX-89A456D", plan: "Pro Developer", monto: 150, metodo: "Tarjeta simulada", estado: "Completado" },
  { id: "3", fecha: "11/07/2026", codigo: "TX-96B452C", plan: "Pro Developer", monto: 150, metodo: "Tarjeta simulada", estado: "Completado" },
  { id: "4", fecha: "11/06/2026", codigo: "TX-42A469G", plan: "Basic Open", monto: 50, metodo: "Tarjeta simulada", estado: "Pendiente" },
  { id: "5", fecha: "11/05/2026", codigo: "TX-56A789C", plan: "Basic Open", monto: 50, metodo: "Tarjeta simulada", estado: "Completado" },
];

let planActual: PlanActual = { planId: "pro-developer", renovacion: "11/10/2026" };

const dos = (n: number): string => String(n).padStart(2, "0");

const formatearFecha = (fecha: Date): string =>
  `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;

// Mismo día del mes siguiente (o el último día si ese mes es más corto).
const sumarUnMes = (fecha: Date): Date => {
  const dia = fecha.getDate();
  const resultado = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(dia, ultimoDia));
  return resultado;
};

export const obtenerHistorial = async (): Promise<Pago[]> => [...pagos];

export const obtenerPlanActual = async (): Promise<PlanActual> => ({ ...planActual });

// Importante: aquí solo entran el plan y el método. Los datos de la tarjeta
// (número, CVV, etc.) nunca salen del formulario, ni siquiera en simulación.
export const contratarPlan = async (data: ContratarPlanData): Promise<Pago> => {
  const plan = getPlan(data.planId);
  if (!plan) throw new Error("Plan no encontrado");

  const hoy = new Date();
  const pago: Pago = {
    id: crypto.randomUUID(),
    fecha: formatearFecha(hoy),
    codigo: `TX-${Math.random().toString(16).slice(2, 9).toUpperCase()}`,
    plan: plan.nombre,
    monto: plan.precio,
    metodo: METODO_TEXTO[data.metodo],
    estado: "Completado",
  };

  pagos = [pago, ...pagos];
  planActual = { planId: plan.id, renovacion: formatearFecha(sumarUnMes(hoy)) };

  return pago;
};
