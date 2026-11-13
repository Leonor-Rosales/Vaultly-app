import { adaptarPlan, type PlanApi } from './adaptadoresPlanesPagos';
import { useEffect, useSyncExternalStore } from 'react';
import { ApiError, getToken } from './auth';
import type { Plan } from '../planes/planesData';

export interface Consumo {
  plan: { id: number; nombre: string; precio_mensual: number };
  // Solo existe en planes de pago: vencimiento y si se renueva sola.
  suscripcion?: { plan_retirado?: boolean; fecha_fin: string; renovacion_automatica: boolean } | null;
  almacenamiento: { cuota_bytes: number; usados_bytes: number; reservados_bytes: number; disponibles_bytes: number; porcentaje_utilizado: number };
  descargas: { limite: number | null; ilimitadas: boolean; consumidas: number; restantes: number | null; inicio: string; fin: string };
  alertas: { almacenamiento: string | null; descargas: string | null };
}
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
let snapshot: { consumo: Consumo | null; error: string } = { consumo: null, error: '' };
let propietario: string | null = null;
let secuencia = 0;
// Refresco automático compartido: varios componentes usan useConsumo a la vez y
// no deben pedir el mismo dato cada uno por su cuenta.
const FRESCO_MS = 5000;
let ultimaConsulta = 0;
let enCurso: { token: string; promesa: Promise<Consumo | null> } | null = null;
const listeners = new Set<() => void>();
const publicar = () => listeners.forEach(fn => fn());
export const obtenerConsumoActual = () => snapshot.consumo;
const suscribir = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

async function consultar<T>(ruta: string): Promise<T> {
  const response = await fetch(API + ruta, { headers: { Authorization: `Bearer ${getToken()}` } });
  const datos = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(datos.error ?? 'No se pudo consultar tu plan.', response.status, datos.codigo);
  return datos;
}
export function limpiarConsumo() {
  secuencia++;
  propietario = null;
  ultimaConsulta = 0;
  enCurso = null;
  snapshot = { consumo: null, error: '' };
  publicar();
}
export async function actualizarConsumo(): Promise<Consumo | null> {
  const token = getToken();
  if (!token) { limpiarConsumo(); return null; }
  if (propietario !== token) {
    propietario = token;
    ultimaConsulta = 0;
    snapshot = { consumo: null, error: '' };
    publicar();
  }
  const orden = ++secuencia;
  try {
    const consumo = await consultar<Consumo>('/api/planes/mi-consumo');
    if (token !== getToken()) return null;
    if (orden !== secuencia) return consumo;
    snapshot = { consumo, error: '' };
    ultimaConsulta = Date.now();
    publicar();
    return consumo;
  } catch (error) {
    if (orden === secuencia && token === getToken()) {
      snapshot = { consumo: snapshot.consumo, error: error instanceof Error ? error.message : 'No se pudo consultar tu plan.' };
      publicar();
    }
    throw error;
  }
}
// Solo para el refresco automático (montar, volver a la ventana, temporizador).
// Las operaciones que cambian el consumo siguen llamando a actualizarConsumo()
// y siempre obtienen un dato nuevo.
function refrescarAutomaticamente(): Promise<Consumo | null> {
  const token = getToken();
  if (token && enCurso && enCurso.token === token) return enCurso.promesa;
  if (token && propietario === token && snapshot.consumo && Date.now() - ultimaConsulta < FRESCO_MS) {
    return Promise.resolve(snapshot.consumo);
  }
  const promesa = actualizarConsumo();
  const registro = { token: token ?? '', promesa };
  enCurso = registro;
  const liberar = () => { if (enCurso === registro) enCurso = null; };
  promesa.then(liberar, liberar);
  return promesa;
}
let suscriptores = 0;
let detenerRefresco: (() => void) | null = null;
function iniciarRefresco() {
  const actualizar = () => { void refrescarAutomaticamente().catch(() => {}); };
  window.addEventListener('focus', actualizar);
  const timer = window.setInterval(actualizar, 60000);
  return () => { window.removeEventListener('focus', actualizar); window.clearInterval(timer); };
}
export function useConsumo() {
  const estado = useSyncExternalStore(suscribir, () => snapshot);
  useEffect(() => {
    suscriptores++;
    if (suscriptores === 1) detenerRefresco = iniciarRefresco();
    void refrescarAutomaticamente().catch(() => {});
    return () => {
      suscriptores--;
      if (suscriptores === 0) { detenerRefresco?.(); detenerRefresco = null; }
    };
  }, []);
  return estado;
}
export async function obtenerCatalogo(): Promise<Plan[]> {
  const planes = await consultar<PlanApi[]>('/api/planes');
  return planes.map(adaptarPlan);
}