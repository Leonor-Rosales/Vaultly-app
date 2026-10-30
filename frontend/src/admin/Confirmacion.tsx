import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Aviso from '../components/Aviso';
import { ConfirmacionContexto } from './confirmacionContexto';
export default function Confirmacion({ children }: { children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const resolver = useRef<(ok: boolean) => void>(undefined);
  const [mensaje, setMensaje] = useState('');
  const preguntar = useCallback((texto: string) => new Promise<boolean>(resolve => {
    resolver.current?.(false); resolver.current = resolve; setMensaje(texto);
  }), []);
  const cerrar = (ok: boolean) => { dialogo.current?.close(); resolver.current?.(ok); resolver.current = undefined; setMensaje(''); };
  useEffect(() => { if (mensaje) dialogo.current?.showModal(); }, [mensaje]);
  useEffect(() => () => { resolver.current?.(false); }, []);
  return <ConfirmacionContexto.Provider value={preguntar}>{children}
    <dialog ref={dialogo} className="admin-dialog" aria-labelledby="confirmar-titulo" onCancel={e => { e.preventDefault(); cerrar(false); }}>
      <h2 id="confirmar-titulo">Confirmar cambio de estado</h2>
      <Aviso variante="advertencia">{mensaje}</Aviso>
      <div className="admin-form-actions"><button type="button" autoFocus className="admin-secondary" onClick={() => cerrar(false)}>Cancelar</button><button type="button" onClick={() => cerrar(true)}>Confirmar</button></div>
    </dialog>
  </ConfirmacionContexto.Provider>;
}
