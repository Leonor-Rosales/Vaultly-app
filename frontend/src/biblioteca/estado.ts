import { tipos, ordenes } from './tipos.ts';
import type { Consulta, Tipo, Orden } from './tipos.ts';

export function leerConsulta(params: URLSearchParams): Consulta {
  const pagina = Number(params.get('pagina') || 1);
  return {
    q: params.get('q') || '',
    tipo: tipos.some(t => t.valor === params.get('tipo')) ? params.get('tipo') as Tipo : '',
    etiquetas: [...new Set(params.getAll('etiqueta_id').map(Number).filter(n => Number.isSafeInteger(n) && n > 0))],
    autor: params.get('autor_id') || '',
    orden: ordenes.some(o => o.valor === params.get('orden')) ? params.get('orden') as Orden : 'recientes',
    pagina: Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}
export function serializar(c: Consulta, http = false): URLSearchParams {
  const p = new URLSearchParams();
  if (c.q) p.set('q', c.q);
  if (c.tipo) p.set('tipo', c.tipo);
  c.etiquetas.forEach(id => p.append('etiqueta_id', String(id)));
  if (c.autor) p.set('autor_id', c.autor);
  p.set('orden', c.orden); p.set('pagina', String(c.pagina));
  if (http) p.set('por_pagina', '12');
  return p;
}
export function cambiarConsulta(c: Consulta, cambios: Partial<Consulta>): Consulta {
  return { ...c, ...cambios, pagina: cambios.pagina ?? 1 };
}
export function limpiarConsulta(c: Consulta): Consulta {
  return { q: '', tipo: '', etiquetas: [], autor: '', orden: c.orden, pagina: 1 };
}
export const tieneFiltros = (c: Consulta) => !!(c.q.trim() || c.tipo || c.autor || c.etiquetas.length);
export function textoResultados(total: number, pagina: number, filtrado: boolean, cantidad: number) {
  if (total > 12 && cantidad > 0) return `Mostrando ${(pagina - 1) * 12 + 1}–${Math.min((pagina - 1) * 12 + cantidad, total)} de ${total} archivos`;
  return `${total} ${total === 1 ? 'archivo' : 'archivos'} ${filtrado ? (total === 1 ? 'encontrado' : 'encontrados') : (total === 1 ? 'disponible' : 'disponibles')}`;
}
export function categoria(mime: string, nombre: string): Tipo {
  if (mime.startsWith('image/')) return 'imagenes';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audio';
  if (/zip|compressed|archive|gzip|tar/.test(mime) || /\.(zip|rar|7z|tar|gz)$/i.test(nombre)) return 'comprimidos';
  if (/pdf|word|officedocument|opendocument|rtf/.test(mime) || /\.(txt|csv|xls|xlsx|ppt|pptx|doc|docx)$/i.test(nombre)) return 'documentos';
  return 'otros';
}

// AbortSignal más una generación: también protege contra adaptadores que ignoren abort().
export function crearSolicitudActual() {
  let version = 0;
  let controller: AbortController | undefined;
  return {
    cancelar() { version++; controller?.abort(); },
    async ejecutar<T>(pedir: (signal: AbortSignal) => Promise<T>, recibir: (valor: T) => void, fallar: (error: unknown) => void) {
      controller?.abort(); controller = new AbortController();
      const actual = ++version;
      try { const valor = await pedir(controller.signal); if (actual === version) recibir(valor); }
      catch (error) { if (actual === version && !controller.signal.aborted) fallar(error); }
    },
  };
}
