import { createContext, useContext } from 'react';
export const ConfirmacionContexto = createContext<(mensaje: string) => Promise<boolean>>(async () => false);
export const useConfirmar = () => useContext(ConfirmacionContexto);
