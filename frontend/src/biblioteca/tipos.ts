export type Tipo = '' | 'documentos' | 'imagenes' | 'videos' | 'audio' | 'comprimidos' | 'otros';
export type Orden = 'recientes' | 'antiguos' | 'nombre_asc' | 'tamanio_desc' | 'tamanio_asc';
export interface EtiquetaPublica { id: number; nombre: string }
export interface AutorPublico { id: string; nombre_completo: string }
export interface ArchivoPublico {
  id: string;
  nombre_original: string;
  tamanio_bytes: string;
  descargas: number;
  tipo_mime: string;
  created_at: string;
  autor: AutorPublico;
  etiquetas: EtiquetaPublica[];
}
export interface Consulta {
  q: string; tipo: Tipo; etiquetas: number[]; autor: string; orden: Orden; pagina: number;
}
export interface Resultados { items: ArchivoPublico[]; total: number; pagina: number; por_pagina: 12 }
export interface ServicioBiblioteca {
  buscar: (consulta: Consulta, signal: AbortSignal) => Promise<Resultados>;
  etiquetas: (q: string, signal: AbortSignal) => Promise<{ items: EtiquetaPublica[] }>;
  autores: (q: string, signal: AbortSignal) => Promise<{ items: AutorPublico[] }>;
}
export const tipos: { valor: Tipo; nombre: string; icono: string }[] = [
  { valor: '', nombre: 'Todos los tipos', icono: 'lucide:files' },
  { valor: 'documentos', nombre: 'Documentos', icono: 'lucide:file-text' },
  { valor: 'imagenes', nombre: 'ImÃ¡genes', icono: 'lucide:image' },
  { valor: 'videos', nombre: 'Videos', icono: 'lucide:video' },
  { valor: 'audio', nombre: 'Audio', icono: 'lucide:music' },
  { valor: 'comprimidos', nombre: 'Comprimidos', icono: 'lucide:archive' },
  { valor: 'otros', nombre: 'Otros', icono: 'lucide:file' },
];
export const ordenes: { valor: Orden; nombre: string }[] = [
  { valor: 'recientes', nombre: 'MÃ¡s recientes' }, { valor: 'antiguos', nombre: 'MÃ¡s antiguos' },
  { valor: 'nombre_asc', nombre: 'Nombre Aâ€“Z' }, { valor: 'tamanio_desc', nombre: 'Mayor tamaÃ±o' },
  { valor: 'tamanio_asc', nombre: 'Menor tamaÃ±o' },
];

