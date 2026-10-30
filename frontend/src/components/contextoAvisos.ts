import { createContext, useContext } from 'react';
import type { Consumo } from '../services/consumo';

export interface Aviso {
  titulo: string;
  mensaje: string;
  detalle?: string;
  tipo?: 'error' | 'info' | 'limite';
  almacenamiento?: Consumo['almacenamiento'];
  planes?: boolean;
  confirmar?: boolean;
}
export interface AccionesAviso {
  avisar: (aviso: Aviso) => void;
  avisarError: (error: unknown, titulo: string, detalle?: string) => void;
  confirmar: (titulo: string, mensaje: string) => Promise<boolean>;
}
export const ContextoAvisos = createContext<AccionesAviso | null>(null);
export function useAvisos() {
  const contexto = useContext(ContextoAvisos);
  if (!contexto) throw new Error('Falta ProveedorAvisos');
  return contexto;
}
