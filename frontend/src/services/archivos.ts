
import { getToken } from "./auth";

const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Archivo {
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
    throw new Error(data.error ?? "No se pudo completar la operación.");
  }

  return data as T;
}

export async function listarArchivos(): Promise<Archivo[]> {
  return solicitud<Archivo[]>("/api/archivos");
}


export async function subirArchivo(
  file: File,
  esPublica: boolean = false
): Promise<Archivo> {
  const formulario = new FormData();

  formulario.append("archivo", file);
  formulario.append("es_publica", String(esPublica));

  return solicitud<Archivo>("/api/archivos", {
    method: "POST",
    body: formulario,
  });
}


export async function eliminarArchivo(id: string): Promise<void> {
  await solicitud<{ mensaje: string }>(
    `/api/archivos/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function descargarArchivo(
  id: string,
  nombre: string
): Promise<void> {
  const token = getToken();

  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  const response = await fetch(
    `${API_URL}/api/archivos/${encodeURIComponent(id)}/descargar`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "No se pudo descargar el archivo.");
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

