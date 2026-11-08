import { request } from './auth';

export interface EntradaPapelera {
  id: string;
  nombre: string;
  tipo: 'carpeta' | 'archivo';
  archivo_id: string | null;
  tipo_mime: string | null;
  ubicacion: string;
  vence_en: string;
  destino_en_raiz: boolean;
  bytes: string;
}
export interface ContenidoPapelera { items: EntradaPapelera[]; bytes: string }
export const consultarPapelera = () => request<ContenidoPapelera>('/api/papelera', {auth:true});
export const restaurarEntrada = (item: EntradaPapelera, nombre?: string) => request(
  `/api/papelera/${item.id}/restaurar`, {auth:true, method:'POST', body:{nombre, aceptarRaiz:item.destino_en_raiz}});
export const purgarEntrada = (id: string) => request(`/api/papelera/${id}`, {auth:true, method:'DELETE'});
