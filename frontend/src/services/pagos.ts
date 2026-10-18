import { ApiError, getToken } from "./auth";
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

// Respuesta del backend (/api/planes/pagos y /api/planes/contratar)
interface PagoApi {
  id: string;
  fecha: string; // ISO
  codigo: string;
  plan: string;
  monto: number;
  metodo: MetodoPago;
  estado: EstadoPago;
}

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta simulada",
  transferencia: "Transferencia simulada",
};

const formatoFecha = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const aPago = (p: PagoApi): Pago => ({
  id: p.id,
  fecha: formatoFecha(p.fecha),
  codigo: p.codigo,
  plan: p.plan,
  monto: p.monto,
  metodo: NOMBRE_METODO[p.metodo] ?? p.metodo,
  estado: p.estado,
});

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API + ruta, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }
  const datos = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      datos.error ?? "No se pudo completar la operación.",
      response.status,
      datos.codigo,
    );
  }
  return datos as T;
}

export const obtenerHistorial = async (): Promise<Pago[]> => {
  const pagos = await pedir<PagoApi[]>("/api/planes/pagos");
  return pagos.map(aPago);
};

export const obtenerPlanActual = async (): Promise<PlanActual> => {
  const consumo = await actualizarConsumo();
  if (!consumo) throw new Error("No se pudo consultar tu plan.");
  return {
    planId: String(consumo.plan.id),
    renovacion: new Date(consumo.descargas.fin).toLocaleDateString("es-GT", {
      timeZone: "UTC",
    }),
  };
};

// Cobro SIMULADO: solo se envía el plan y el método; los datos de tarjeta nunca salen del navegador.
export const contratarPlan = async (data: ContratarPlanData): Promise<Pago> => {
  const pago = await pedir<PagoApi>("/api/planes/contratar", {
    method: "POST",
    body: JSON.stringify({ planId: Number(data.planId), metodo: data.metodo }),
  });
  // Refresca el plan en el Dashboard/Planes (cuota, descargas, nombre del plan).
  await actualizarConsumo().catch(() => undefined);
  return aPago(pago);
};
