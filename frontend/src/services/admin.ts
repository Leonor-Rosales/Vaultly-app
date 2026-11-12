import { request } from './auth';
export interface PlanAdmin {
  tiene_suscripciones?: boolean;
  inactivo_desde?: string | null;
  archivado_en?: string | null;
  retiro_desde?: string | null;
  tiene_historial?: boolean;
  promocion_tipo?: 'FIJO' | 'PORCENTAJE' | 'GRATIS' | null;
  promocion_porcentaje?: number | string | null;
  promocion_precio?: number | string | null;
  promocion_inicio?: string | null;
  promocion_fin?: string | null;
  version: number;
  suscripciones_vigentes?: number;
  id: number; nombre: string; precio_mensual: number | string; cuota_storage_gb: number;
  limite_descargas: number | null; permite_carpetas_publicas: boolean; activo: boolean;
}
export interface Administrador {
  id: string; nombre_completo: string; correo_electronico: string; estado_cuenta: string; created_at: string;
}
export const listarPlanes = () => request<PlanAdmin[]>('/api/admin/planes', { auth: true });
export const guardarPlan = (datos: Omit<PlanAdmin, 'id' | 'version'> & { version?: number }, id?: number) => request<PlanAdmin>(`/api/admin/planes${id ? `/${id}` : ''}`, { auth: true, method: id ? 'PUT' : 'POST', body: { ...datos, ...(datos.promocion_precio !== undefined ? { promocion_precio: datos.promocion_precio === null ? null : Number(datos.promocion_precio) } : {}), ...(datos.promocion_porcentaje !== undefined ? { promocion_porcentaje: datos.promocion_porcentaje === null ? null : Number(datos.promocion_porcentaje) } : {}) } });
export const listarAdministradores = () => request<Administrador[]>('/api/admin/administradores', { auth: true });
export const guardarAdministrador = (datos: { nombre_completo: string; correo_electronico: string; activo: boolean; password?: string }, id?: string) => request<Administrador>(`/api/admin/administradores${id ? `/${id}` : ''}`, { auth: true, method: id ? 'PUT' : 'POST', body: datos });

export interface PagoAdmin {
  id: string;
  nombre_completo: string;
  correo_electronico: string;
  plan_nombre: string;
  monto: string;
  estado: 'COMPLETADO' | 'PENDIENTE';
  creado_en: string;
}
export const listarPagos = () => request<PagoAdmin[]>('/api/admin/pagos', { auth: true });

export interface EventoAuditoria {
  id: string; usuario_id: string | null; administrador: string; codigo: string; fecha_hora: string; modulo_afectado: string;
  detalles_json: { anterior: Record<string, unknown> | null; nuevo: Record<string, unknown> | null };
}
export interface Auditoria { items: EventoAuditoria[]; total: number; pagina: number; por_pagina: number }
export const listarAuditoria = (filtros: { pagina: number; accion: string; q: string; desde: string; hasta: string }) => request<Auditoria>(`/api/admin/auditoria?${new URLSearchParams({ ...filtros, pagina: String(filtros.pagina) })}`, { auth: true });

export function mensajeEstadoPlan(plan: PlanAdmin) {
  if (!plan.activo) return `¿Activar el plan ${plan.nombre}? Se cancelará su retiro automático.`;
  return `¿Desactivar el plan ${plan.nombre}? Suscripciones vigentes: ${plan.suscripciones_vigentes ?? 0}. Los clientes afectados verán un aviso en su cuenta y se programará un correo, tengan o no renovación automática. Conservarán sus beneficios hasta el vencimiento y después pasarán a Free sin otro cobro si el plan sigue inactivo. Tras 30 días inactivo, se retirará del listado cuando ya no tenga suscripciones vigentes; si tiene historial se conservará internamente y, si nunca se usó, se eliminará definitivamente.`;
}
