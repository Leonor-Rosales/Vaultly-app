import { useEffect, useSyncExternalStore } from 'react';
import { ApiError, getToken } from './auth';
import type { Plan } from '../planes/planesData';

export interface Consumo {
  plan: { id: number; nombre: string; precio_mensual: number };
  almacenamiento: { cuota_bytes: number; usados_bytes: number; reservados_bytes: number; disponibles_bytes: number; porcentaje_utilizado: number };
  descargas: { limite: number | null; ilimitadas: boolean; consumidas: number; restantes: number | null; inicio: string; fin: string };
  alertas: { almacenamiento: string | null; descargas: string | null };
}
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
let snapshot: { consumo: Consumo | null; error: string } = { consumo: null, error: '' };
let propietario: string | null = null;
let secuencia = 0;
const listeners = new Set<() => void>();
const publicar = () => listeners.forEach(fn => fn());
// La última lectura fallida se puede mostrar, pero no debe bloquear operaciones con datos obsoletos.
export const obtenerConsumoActual = () => snapshot.error ? null : snapshot.consumo;
const suscribir = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

async function consultar<T>(ruta: string): Promise<T> {
  const response = await fetch(API + ruta, { headers: { Authorization: `Bearer ${getToken()}` }, signal: AbortSignal.timeout(10000) });
  const datos = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(datos.error ?? 'No se pudo consultar tu plan.', response.status, datos.codigo);
  return datos;
}
export function limpiarConsumo() {
  secuencia++;
  propietario = null;
  snapshot = { consumo: null, error: '' };
  publicar();
}
export async function actualizarConsumo(): Promise<Consumo | null> {
  const token = getToken();
  if (!token) { limpiarConsumo(); return null; }
  if (propietario !== token) {
    propietario = token;
    snapshot = { consumo: null, error: '' };
    publicar();
  }
  const orden = ++secuencia;
  try {
    const consumo = await consultar<Consumo>('/api/planes/mi-consumo');
    if (token !== getToken()) return null;
    if (orden !== secuencia) return consumo;
    snapshot = { consumo, error: '' };
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
export function useConsumo() {
  const estado = useSyncExternalStore(suscribir, () => snapshot);
  useEffect(() => {
    const actualizar = () => { void actualizarConsumo().catch(() => {}); };
    actualizar();
    window.addEventListener('focus', actualizar);
    const timer = window.setInterval(actualizar, 60000);
    return () => { window.removeEventListener('focus', actualizar); window.clearInterval(timer); };
  }, []);
  return estado;
}
export async function obtenerCatalogo(): Promise<Plan[]> {
  const planes = await consultar<{ id: number; nombre: string; cuota_storage_gb: number; precio_mensual: string; limite_descargas: number | null }[]>('/api/planes');
  return planes.map(p => ({ id: String(p.id), nombre: p.nombre, precio: Number(p.precio_mensual), almacenamientoGb: p.cuota_storage_gb, descargasMensuales: p.limite_descargas }));
}
