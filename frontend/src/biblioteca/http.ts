import type { ServicioBiblioteca, Resultados, EtiquetaPublica, AutorPublico } from './tipos.ts';
import { serializar } from './estado.ts';

const objeto = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === 'object';
const autorValido = (a: unknown) => objeto(a) && typeof a.id === 'string' && typeof a.nombre_completo === 'string';
const etiquetaValida = (e: unknown) => objeto(e) && Number.isSafeInteger(e.id) && Number(e.id) > 0 && typeof e.nombre === 'string';
const archivoValido = (a: unknown) => objeto(a) && typeof a.id === 'string' && typeof a.nombre_original === 'string' &&
  typeof a.tamanio_bytes === 'string' && /^\d+$/.test(a.tamanio_bytes) && typeof a.tipo_mime === 'string' &&
  typeof a.created_at === 'string' && Number.isFinite(Date.parse(a.created_at)) && autorValido(a.autor) &&
  Array.isArray(a.etiquetas) && a.etiquetas.every(etiquetaValida);

export function crearBibliotecaHttp(baseUrl: string, token: () => string | null, transporte: typeof fetch = fetch): ServicioBiblioteca {
  async function pedir<T>(ruta: string, signal: AbortSignal): Promise<T> {
    const sesion = token();
    if (!sesion) throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
    const respuesta = await transporte(`${baseUrl}${ruta}`, { signal, headers: { Authorization: `Bearer ${sesion}` } });
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new Error(datos?.error || 'No se pudo conectar con la biblioteca. Inténtalo de nuevo.');
    if (!datos || !Array.isArray(datos.items)) throw new Error('La biblioteca devolvió una respuesta inválida.');
    return datos as T;
  }
  const opciones = (q: string) => new URLSearchParams({ q, limite: '20' });
  return {
    async buscar(c, signal) {
      const datos = await pedir<Resultados>(`/api/biblioteca/archivos?${serializar(c, true)}`, signal);
      if (!Number.isSafeInteger(datos.total) || datos.total < 0 || datos.pagina !== c.pagina || datos.por_pagina !== 12) {
        throw new Error('La biblioteca devolvió una paginación inválida.');
      }
      if (datos.items.length > 12 || !datos.items.every(archivoValido)) throw new Error('La biblioteca devolvió archivos con un formato inválido.');
      return datos;
    },
    async etiquetas(q, signal) {
      const datos = await pedir<{items: EtiquetaPublica[]}>(`/api/biblioteca/etiquetas?${opciones(q)}`, signal);
      if (!datos.items.every(etiquetaValida)) throw new Error('La biblioteca devolvió etiquetas inválidas.');
      return datos;
    },
    async autores(q, signal) {
      const datos = await pedir<{items: AutorPublico[]}>(`/api/biblioteca/autores?${opciones(q)}`, signal);
      if (!datos.items.every(autorValido)) throw new Error('La biblioteca devolvió autores inválidos.');
      return datos;
    },
  };
}
