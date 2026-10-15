import { getToken } from '../services/auth';
import { crearBibliotecaHttp } from './http';
import { crearBibliotecaDemo } from './demo';

export const demostracion = import.meta.env.VITE_BIBLIOTECA_MOCK === 'true';
export const biblioteca = demostracion ? crearBibliotecaDemo() : crearBibliotecaHttp(import.meta.env.VITE_API_URL ?? 'http://localhost:3000', getToken);
