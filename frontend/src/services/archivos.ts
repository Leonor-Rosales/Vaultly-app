
import { actualizarConsumo } from "./consumo";
import { ApiError, getToken } from "./auth";

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
  etiquetas: string[] = []
): Promise<Archivo> {
  if (file.size > 50 * 1024 * 1024) {
    throw new ApiError('El archivo supera el tamaño máximo de 50 MB. Selecciona uno más pequeño.', 413, 'ARCHIVO_DEMASIADO_GRANDE');
  }
  const formulario = new FormData();

  formulario.append("archivo", file);
  formulario.append("etiquetas", JSON.stringify(etiquetas));
  formulario.append("es_publica", String(esPublica));

  try { return await solicitud<Archivo>("/api/archivos", {
    method: "POST",
    body: formulario,
  }); } finally { await actualizarConsumo().catch(() => {}); }
}


export async function eliminarArchivo(id: string): Promise<void> {
  try { await solicitud<{ mensaje: string }>(
    `/api/archivos/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  ); } finally { await actualizarConsumo().catch(() => {}); }
}

export async function descargarArchivo(
  id: string,
  nombre: string
): Promise<void> {
  const token = getToken();

  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  try {
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
  } finally { await actualizarConsumo().catch(() => {}); }
}


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
