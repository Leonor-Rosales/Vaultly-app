import { request, type Usuario } from './auth';
export interface SolicitudCorreo {
  id: string; correo: string; estado: 'PENDIENTE' | 'ENVIANDO' | 'FALLIDO' | 'BLOQUEADO';
  vence_en: string; reenviar_desde: string; intentos_restantes: number; vencido: boolean;
}
const ruta = '/api/cuenta/cambio-correo';
export const obtenerCambioCorreo = () => request<{ solicitud: SolicitudCorreo | null }>(ruta, { auth: true });
export const solicitarCambioCorreo = (correo: string, password: string) => request<{ solicitud: SolicitudCorreo; mensaje: string }>(ruta, { auth: true, method: 'POST', body: { correo, password } });
export const confirmarCambioCorreo = (solicitud_id: string, codigo: string) => request<{ usuario: Usuario; mensaje: string; notificado: boolean }>(`${ruta}/confirmar`, { auth: true, method: 'POST', body: { solicitud_id, codigo } });
export const cancelarCambioCorreo = () => request<{ mensaje: string }>(ruta, { auth: true, method: 'DELETE' });
