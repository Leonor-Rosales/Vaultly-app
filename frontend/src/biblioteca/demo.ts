import type { ArchivoPublico, AutorPublico, EtiquetaPublica, ServicioBiblioteca } from './tipos.ts';
import { categoria } from './estado.ts';

export const normalizarBusqueda = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const autores: AutorPublico[] = ['Fernando Pérez', 'Ana Martínez', 'Carlos Gómez', 'Elena Ríos', 'Sofía Castro', 'Mateo Díaz', 'Lucía Sáenz'].map((nombre_completo, i) => ({id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, nombre_completo}));
const etiquetas: EtiquetaPublica[] = ['UI/UX', 'Figma', 'DevOps', 'AWS', 'Backend', 'Auth', '3D', 'Assets', 'Legal', 'Templates', 'Negocios', 'Pitch', 'Frontend', 'HTML', 'Iconos', 'Diseño', 'Matemáticas', 'Audio', 'Video'].map((nombre, i) => ({id: i + 1, nombre}));
const semillas: [string, string, string, number, number[]][] = [
  ['Guia_Estilos_UI_Kit.fig', 'application/octet-stream', '42800000', 0, [1,2]],
  ['Manual_Despliegue_AWS.pdf', 'application/pdf', '3400000', 1, [3,4]],
  ['auth_middleware_v2.ts', 'text/typescript', '18000', 2, [5,6]],
  ['Assets_Ilustraciones_3D.zip', 'application/zip', '185000000', 3, [7,8]],
  ['Contrato_Servicios_Plantilla.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '450000', 4, [9,10]],
  ['Presentacion_Inversores_2026.pdf', 'application/pdf', '12100000', 0, [11,12]],
  ['landing_page_responsive.html', 'text/html', '45000', 5, [13,14]],
  ['Pack_Iconos_Productividad.svg', 'image/svg+xml', '2100000', 6, [15,16]],
  ['Introducción_al_diseño.mp4', 'video/mp4', '31000000', 6, [16,19]],
  ['Sonidos_interfaz.mp3', 'audio/mpeg', '2900000', 3, [8,18]],
  ['Resumen_Matemáticas.pdf', 'application/pdf', '1250000', 1, [17]],
  ['Fotografía_arquitectura.jpg', 'image/jpeg', '6100000', 5, [16]],
  ['Componentes_web.zip', 'application/zip', '7300000', 2, [13,8]],
  ['Guía_de_accesibilidad.pdf', 'application/pdf', '980000', 0, [1,16]],
  ['Entrevista_comunidad.wav', 'audio/wav', '14300000', 4, [18]],
  ['Tutorial_AWS.webm', 'video/webm', '23600000', 1, [4,19]],
  ['Plantilla_presupuesto.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '85000', 4, [10,11]],
  ['Notas_proyecto.txt', 'text/plain', '4000', 2, []],
];
export const archivosDemo: ArchivoPublico[] = semillas.map(([nombre_original, tipo_mime, tamanio_bytes, autor, tags], i) => ({
  id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, nombre_original, tipo_mime, tamanio_bytes,
  created_at: new Date(Date.UTC(2026, 9, 14 - i, 12)).toISOString(), autor: autores[autor],
  etiquetas: tags.map(id => etiquetas.find(e => e.id === id)!),
  descargas: 0,
}));
export function crearBibliotecaDemo(archivos: ArchivoPublico[] = archivosDemo): ServicioBiblioteca {
  const contiene = (texto: string, q: string) => normalizarBusqueda(texto).includes(normalizarBusqueda(q.trim()));
  return {
    async buscar(c, signal) {
      signal.throwIfAborted();
      const items = archivos.filter(a =>
        (!c.q.trim() || [a.nombre_original, a.autor.nombre_completo, ...a.etiquetas.map(e => e.nombre)].some(n => contiene(n, c.q))) &&
        (!c.tipo || categoria(a.tipo_mime, a.nombre_original) === c.tipo) &&
        (!c.autor || a.autor.id === c.autor) &&
        (!c.etiquetas.length || a.etiquetas.some(e => c.etiquetas.includes(e.id)))
      ).sort((a,b) => {
        let diferencia = 0;
        if (c.orden === 'nombre_asc') diferencia = a.nombre_original.localeCompare(b.nombre_original, 'es', {sensitivity: 'base'});
        else if (c.orden.startsWith('tamanio')) {
          const x = BigInt(a.tamanio_bytes), y = BigInt(b.tamanio_bytes);
          diferencia = (x < y ? -1 : x > y ? 1 : 0) * (c.orden === 'tamanio_desc' ? -1 : 1);
        } else diferencia = (Date.parse(a.created_at) - Date.parse(b.created_at)) * (c.orden === 'recientes' ? -1 : 1);
        return diferencia || a.id.localeCompare(b.id);
      });
      return {items: items.slice((c.pagina - 1) * 12, c.pagina * 12), total: items.length, pagina: c.pagina, por_pagina: 12};
    },
    async etiquetas(q, signal) {
      signal.throwIfAborted();
      return {items: [...new Map(archivos.flatMap(a => a.etiquetas).map(e => [e.id, e])).values()].filter(e => contiene(e.nombre, q)).sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0,20)};
    },
    async autores(q, signal) {
      signal.throwIfAborted();
      return {items: [...new Map(archivos.map(a => [a.autor.id, a.autor])).values()].filter(a => contiene(a.nombre_completo, q)).sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es')).slice(0,20)};
    },
  };
}
