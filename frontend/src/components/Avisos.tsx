import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Icon from './IconoAviso';
import { ApiError } from '../services/auth';
import { obtenerConsumoActual } from '../services/consumo';
import { ContextoAvisos, type Aviso } from './contextoAvisos';
import BarraAlmacenamiento from './BarraAlmacenamiento';
import './Avisos.css';

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const resolver = useRef<((valor: boolean) => void) | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const cerrar = useCallback((confirmado = false) => {
    resolver.current?.(confirmado);
    resolver.current = null;
    setAviso(null);
  }, []);
  const avisar = useCallback((nuevo: Aviso) => {
    resolver.current?.(false);
    resolver.current = null;
    setAviso(nuevo);
  }, []);
  const confirmar = useCallback((titulo: string, mensaje: string) => new Promise<boolean>(resolve => {
    resolver.current?.(false);
    resolver.current = resolve;
    setAviso({ titulo, mensaje, confirmar: true });
  }), []);
  const avisarError = useCallback((error: unknown, titulo: string, detalle?: string) => {
    const consumo = obtenerConsumoActual();
    const mensaje = error instanceof Error ? error.message : 'No se pudo completar la operación. Inténtalo de nuevo.';
    if (error instanceof ApiError && ['CUOTA_ALMACENAMIENTO', 'CUOTA_EXCEDIDA'].includes(error.code ?? '')) {
      const lleno = consumo && consumo.almacenamiento.usados_bytes >= consumo.almacenamiento.cuota_bytes;
      avisar({ titulo: lleno ? 'Almacenamiento lleno' : 'Espacio insuficiente',
        mensaje: `${mensaje} Libera espacio o cambia a un plan superior.`, detalle, tipo: 'limite', planes: true,
        almacenamiento: consumo?.almacenamiento });
    } else if (error instanceof ApiError && error.code === 'CUOTA_DESCARGAS') {
      avisar({ titulo: 'Límite de descargas agotado', mensaje: 'Has utilizado las descargas disponibles de tu plan. Podrás descargar de nuevo cuando se renueve tu ciclo o al cambiar de plan.', detalle, tipo: 'limite', planes: true });
    } else {
      avisar({ titulo, mensaje: error instanceof TypeError ? 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.' : mensaje, detalle, tipo: 'error' });
    }
  }, [avisar]);
  const acciones = useMemo(() => ({ avisar, avisarError, confirmar }), [avisar, avisarError, confirmar]);
  useEffect(() => {
    if (!aviso) return;
    const nodo = dialogo.current;
    const anterior = document.activeElement;
    nodo?.showModal();
    return () => {
      nodo?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [aviso]);
  useEffect(() => () => { resolver.current?.(false); }, []);
  const ir = (ruta: string) => { cerrar(); navigate(ruta); };

  return <ContextoAvisos.Provider value={acciones}>
    {children}
    {aviso && createPortal(<dialog ref={dialogo} className="aviso-dialogo" aria-labelledby="aviso-titulo" aria-describedby="aviso-mensaje"
      onCancel={event => { event.preventDefault(); cerrar(); }}>
      <button className="aviso-cerrar" type="button" onClick={() => cerrar()} aria-label="Cerrar aviso"><Icon icon="lucide:x" /></button>
      <span className="aviso-icono"><Icon icon={aviso.confirmar ? 'lucide:trash-2' : aviso.tipo === 'limite' ? 'lucide:hard-drive' : aviso.tipo === 'error' ? 'lucide:circle-alert' : 'lucide:info'} /></span>
      <h2 id="aviso-titulo">{aviso.titulo}</h2>
      <p id="aviso-mensaje">{aviso.mensaje}</p>
      {aviso.almacenamiento && <BarraAlmacenamiento almacenamiento={aviso.almacenamiento} />}
      {aviso.detalle && <p className="aviso-detalle">{aviso.detalle}</p>}
      <div className="aviso-acciones">
        {aviso.confirmar ? <>
          <button type="button" className="aviso-boton secundario" onClick={() => cerrar()}>Cancelar</button>
          <button type="button" className="aviso-boton" onClick={() => cerrar(true)}>Eliminar archivo</button>
        </> : aviso.planes ? <>
          <button type="button" className="aviso-boton secundario" onClick={() => aviso.almacenamiento ? ir('/archivos') : cerrar()}>{aviso.almacenamiento ? 'Administrar archivos' : 'Entendido'}</button>
          <button type="button" className="aviso-boton" onClick={() => ir('/planes')}>Ver planes</button>
        </> : <button type="button" className="aviso-boton" onClick={() => cerrar()}>Entendido</button>}
      </div>
    </dialog>, document.body)}
  </ContextoAvisos.Provider>;
}
