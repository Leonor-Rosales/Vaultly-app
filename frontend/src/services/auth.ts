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