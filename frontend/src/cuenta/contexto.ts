import { createContext, useContext } from 'react';
import type { Usuario } from '../services/auth';
export const CuentaContexto = createContext<{ usuario: Usuario; actualizar: (usuario: Usuario) => void } | null>(null);
export function useCuenta() {
  const cuenta = useContext(CuentaContexto);
  if (!cuenta) throw new Error('La cuenta requiere una sesión verificada');
  return cuenta;
}
