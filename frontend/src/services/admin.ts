import { request } from './auth';
export interface PlanAdmin {
  id: number; nombre: string; precio_mensual: number | string; cuota_storage_gb: number;
  limite_descargas: number | null; permite_carpetas_publicas: boolean; activo: boolean;
}
export interface Administrador {
  id: string; nombre_completo: string; correo_electronico: string; estado_cuenta: string; created_at: string;
}
export const listarPlanes = () => request<PlanAdmin[]>('/api/admin/planes', { auth: true });
export const guardarPlan = (datos: Omit<PlanAdmin, 'id'>, id?: number) => request<PlanAdmin>(`/api/admin/planes${id ? `/${id}` : ''}`, { auth: true, method: id ? 'PUT' : 'POST', body: datos });
export const listarAdministradores = () => request<Administrador[]>('/api/admin/administradores', { auth: true });
export const guardarAdministrador = (datos: { nombre_completo: string; correo_electronico: string; activo: boolean; password?: string }, id?: string) => request<Administrador>(`/api/admin/administradores${id ? `/${id}` : ''}`, { auth: true, method: id ? 'PUT' : 'POST', body: datos });
