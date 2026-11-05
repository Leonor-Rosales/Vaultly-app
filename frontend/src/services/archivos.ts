
import { actualizarConsumo } from "./consumo";
import { ApiError, getToken } from "./auth";
import { conActualizacionConsumo } from './conActualizacionConsumo';

const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Archivo {
  etiquetas: { id: number; nombre: string }[];
  usuario_id?: string;
  id: string;
  nombre_original: string;
  tamanio_bytes: number | string;
  tipo_mime: string;
  es_publica: boolean;
  carpeta_id: string | null;
  created_at: string;
}

export type ArchivoVistaPrevia = Pick<Archivo, 'id' | 'nombre_original' | 'tipo_mime' | 'tamanio_bytes'>;

async function solicitud<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? "No se pudo completar la operación.", response.status, data.codigo);
  }

  return data as T;
}

export async function listarArchivos(): Promise<Archivo[]> {
  return solicitud<Archivo[]>("/api/archivos");
}

export async function listarPublicos(): Promise<Archivo[]> {
  return solicitud<Archivo[]>("/api/archivos/publicos");
}


export async function subirArchivo(
  file: File,
  esPublica: boolean = false,
  etiquetas: string[] = [],
  carpetaId: string | null = null
): Promise<Archivo> {
  const formulario = new FormData();

  if (carpetaId) formulario.append("carpeta_id", carpetaId);
  formulario.append("archivo", file);
  formulario.append("etiquetas", JSON.stringify(etiquetas));
  formulario.append("es_publica", String(esPublica));

  return enviarArchivo(formulario);
}

const enviarArchivo = conActualizacionConsumo(
  (formulario: FormData) => solicitud<Archivo>("/api/archivos", {
    method: "POST",
    body: formulario,
  }),
  actualizarConsumo,
);

export const eliminarArchivo = conActualizacionConsumo(async (id: string): Promise<void> => {
  await solicitud<{ mensaje: string }>(
    `/api/archivos/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}, actualizarConsumo);

export async function descargarArchivo(
  id: string,
  nombre: string
): Promise<void> {
  const token = getToken();

  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  return descargarContenido(id, nombre, token);
}

const descargarContenido = conActualizacionConsumo(async (
  id: string, nombre: string, token: string,
): Promise<void> => {
  const response = await fetch(
    `${API_URL}/api/archivos/${encodeURIComponent(id)}/descargar`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error ?? "No se pudo descargar el archivo.", response.status, data.codigo);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}, actualizarConsumo);


export async function cambiarVisibilidad(
  id: string,
  esPublica: boolean
): Promise<Archivo> {
  return solicitud<Archivo>(
    `/api/archivos/${encodeURIComponent(id)}/visibilidad`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ es_publica: esPublica }),
    }
  );
}


export function editarEtiquetas(id: string, etiquetas: string[]): Promise<Archivo> {
  return solicitud<Archivo>(`/api/archivos/${encodeURIComponent(id)}/etiquetas`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiquetas }),
  });
}

export interface Carpeta {
  id: string;
  nombre: string;
  carpeta_padre_id: string | null;
}

const json = (method: string, body: object) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
export const listarCarpetas = () => solicitud<Carpeta[]>('/api/carpetas');
export const crearCarpeta = (nombre: string, padre: string | null) =>
  solicitud<Carpeta>('/api/carpetas', json('POST', { nombre, padre }));
export const renombrarCarpeta = (id: string, nombre: string) =>
  solicitud<Carpeta>(`/api/carpetas/${id}/nombre`, json('PATCH', { nombre }));
export const moverCarpeta = (id: string, padre: string | null) =>
  solicitud<Carpeta>(`/api/carpetas/${id}/destino`, json('PATCH', { padre }));
export const renombrarArchivo = (id: string, nombre: string) =>
  solicitud<Pick<Archivo, 'id' | 'nombre_original'>>(`/api/archivos/${encodeURIComponent(id)}/nombre`, json('PATCH', { nombre }));
export const moverArchivo = (id: string, padre: string | null) =>
  solicitud<{ carpeta_id: string | null }>(`/api/carpetas/archivos/${id}/destino`, json('PATCH', { padre }));
export const eliminarCarpeta = (id: string) => solicitud(`/api/carpetas/${id}`, { method: 'DELETE' });

export async function obtenerVistaPrevia(id: string, signal: AbortSignal, miniatura = false): Promise<Blob> {
  const token = getToken();
  if (!token) throw new Error('Tu sesión ha expirado.');
  const respuesta = await fetch(`${API_URL}/api/archivos/${encodeURIComponent(id)}/${miniatura ? "miniatura" : "vista-previa"}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  });
  if (!respuesta.ok) throw new Error('No se pudo cargar la vista previa.');
  return respuesta.blob();
}


export type EstadoVistaPrevia = { estado: 'PENDIENTE' | 'PROCESANDO' | 'LISTA' | 'FALLIDA' };
export const estadoVistaPrevia = (id: string, signal: AbortSignal) =>
  solicitud<EstadoVistaPrevia>(`/api/archivos/${encodeURIComponent(id)}/estado-vista-previa`, { signal });
export const reintentarVistaPrevia = (id: string) =>
  solicitud<EstadoVistaPrevia>(`/api/archivos/${encodeURIComponent(id)}/reintentar-vista-previa`, { method: 'POST' });
