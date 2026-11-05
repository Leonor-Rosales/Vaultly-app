import { adaptarPago, type PagoApi } from './adaptadoresPlanesPagos';
import { ApiError, getToken } from "./auth";
import { actualizarConsumo } from "./consumo";

// Solo se puede contratar con tarjeta simulada.
export type MetodoPago = "tarjeta";
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
  renovacion: string; // fin del ciclo de descargas, dd/mm/aaaa
  venceEl: string | null; // vencimiento de la suscripción de pago (null en Free)
  renovacionAutomatica: boolean;
}

export interface ContratarPlanData {
  planId: string;
  metodo: MetodoPago;
  renovar?: boolean; // renovación automática al vencer
}

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
  return pagos.map(adaptarPago);
};

export const obtenerPlanActual = async (): Promise<PlanActual> => {
  const consumo = await actualizarConsumo();
  if (!consumo) throw new Error("No se pudo consultar tu plan.");
  return {
    planId: String(consumo.plan.id),
    renovacion: new Date(consumo.descargas.fin).toLocaleDateString("es-GT", {
      timeZone: "UTC",
    }),
    venceEl: consumo.suscripcion
      ? new Date(consumo.suscripcion.fecha_fin).toLocaleDateString("es-GT")
      : null,
    renovacionAutomatica: consumo.suscripcion?.renovacion_automatica === true,
  };
};

// Activa o desactiva la renovación automática del plan de pago vigente.
export const configurarRenovacion = async (renovar: boolean): Promise<void> => {
  await pedir<{ renovacionAutomatica: boolean; fechaFin: string }>("/api/planes/renovacion", {
    method: "PATCH",
    body: JSON.stringify({ renovar }),
  });
  await actualizarConsumo().catch(() => undefined);
};

// Cobro SIMULADO: solo se envía el plan y el método; los datos de tarjeta nunca salen del navegador.
export const contratarPlan = async (data: ContratarPlanData): Promise<Pago> => {
  const pago = await pedir<PagoApi>("/api/planes/contratar", {
    method: "POST",
    body: JSON.stringify({ planId: Number(data.planId), metodo: data.metodo, renovar: data.renovar === true }),
  });
  // Refresca el plan en el Dashboard/Planes (cuota, descargas, nombre del plan).
  await actualizarConsumo().catch(() => undefined);
  return adaptarPago(pago);
};
