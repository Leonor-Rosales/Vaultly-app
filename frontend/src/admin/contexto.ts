import { useOutletContext } from 'react-router-dom';
import type { Usuario } from '../services/auth';
type Contexto = { usuario: Usuario; actualizar: () => void };
export const useAdministrador = () => useOutletContext<Contexto>().usuario;
export const useActualizarPerfil = () => useOutletContext<Contexto>().actualizar;
