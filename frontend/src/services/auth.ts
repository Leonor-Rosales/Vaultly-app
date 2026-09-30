const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface Usuario {
  id: string;
  nombre_completo: string;
  correo_electronico: string;
  rol: "ADMIN" | "CLIENTE";
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface RegisterResponse {
  mensaje: string;
  correo_enviado: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const getToken = (): string | null =>
  localStorage.getItem("token");

export const logout = (): void => {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
};

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();

  if (options.auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body
        ? JSON.stringify(options.body)
        : undefined,
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. ¿Está encendido el backend?",
      0
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.error ?? "Ocurrió un error inesperado",
      response.status,
      data.codigo
    );
  }

  return data as T;
}

// ================================
// LOGIN
// ================================

export const login = async (
  data: LoginData
): Promise<LoginResponse> => {
  const result = await request<LoginResponse>(
    "/api/auth/login",
    {
      method: "POST",
      body: {
        correo_electronico: data.email,
        password: data.password,
      },
    }
  );

  localStorage.setItem("token", result.token);
  localStorage.setItem(
    "usuario",
    JSON.stringify(result.usuario)
  );

  return result;
};

// ================================
// REGISTRO
// ================================

export const register = async (
  data: RegisterData
): Promise<RegisterResponse> => {
  return request<RegisterResponse>(
    "/api/auth/register",
    {
      method: "POST",
      body: {
        nombre_completo: data.name,
        correo_electronico: data.email,
        password: data.password,
        confirmar_password: data.confirmPassword,
      },
    }
  );
};

// ================================
// VERIFICACIÓN DE CORREO
// ================================

export const resendVerification = async (
  email: string
): Promise<{ mensaje: string }> => {
  return request<{ mensaje: string }>(
    "/api/auth/reenviar-verificacion",
    {
      method: "POST",
      body: {
        correo_electronico: email,
      },
    }
  );
};

// ================================
// PERFIL
// ================================

// Comprueba que la sesión siga válida.
export const getProfile = async (): Promise<{
  usuario: Usuario;
}> => {
  return request<{ usuario: Usuario }>(
    "/api/auth/me",
    {
      auth: true,
    }
  );
};

// ================================
// RECUPERACIÓN DE CONTRASEÑA
// ================================

export interface RequestPasswordResetData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

// Solicita que se envíe el correo para recuperar la contraseña.
export const requestPasswordReset = async (
  data: RequestPasswordResetData
): Promise<{ mensaje: string }> => {
  return request<{ mensaje: string }>(
    "/api/auth/recuperar",
    {
      method: "POST",
      body: {
        email: data.email,
      },
    }
  );
};

// Cambia la contraseña utilizando el token recibido por correo.
export const resetPassword = async (
  data: ResetPasswordData
): Promise<{ mensaje: string }> => {
  return request<{ mensaje: string }>(
    "/api/auth/restablecer",
    {
      method: "POST",
      body: {
        token: data.token,
        password: data.password,
      },
    }
  );
};