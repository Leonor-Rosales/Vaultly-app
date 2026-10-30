import { request, type Usuario } from './auth';
export const guardarNombre = (nombre_completo: string) => request<{ usuario: Usuario }>('/api/cuenta/perfil', { auth: true, method: 'PATCH', body: { nombre_completo } });
