export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export const login = async (data: LoginData) => {
  console.log("Datos de login:", data);
};

export const register = async (data: RegisterData) => {
  console.log("Datos de registro:", data);
};
export interface RequestPasswordResetData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

export const requestPasswordReset = async (data: RequestPasswordResetData) => {
  console.log("Solicitud de recuperación:", data);
};

export const resetPassword = async (data: ResetPasswordData) => {
  console.log("Restablecer contraseña:", data);
};