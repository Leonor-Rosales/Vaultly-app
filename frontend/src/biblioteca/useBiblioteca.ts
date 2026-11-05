import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { crearSolicitudActual, leerConsulta, serializar, cambiarConsulta, limpiarConsulta } from './estado';
import type { Consulta } from './tipos';
import { biblioteca } from './servicio';

export function useRecurso<T>(pedir: (signal: AbortSignal) => Promise<T>, espera = 300) {
  const [estado, setEstado] = useState<{pedir: typeof pedir; datos?: T; error?: string} | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const solicitud = crearSolicitudActual();
    const timer = setTimeout(() => {
      void solicitud.ejecutar(pedir, datos => setEstado({pedir, datos}), error => setEstado({pedir, error: error instanceof Error ? error.message : 'No se pudo conectar. Inténtalo de nuevo.'}));
    }, espera);
    return () => { clearTimeout(timer); solicitud.cancelar(); };
  }, [pedir, espera, intento]);
  const actual = estado?.pedir === pedir ? estado : null;
  return {datos: actual?.datos, datosAnteriores: estado?.datos, error: actual?.error, cargando: !actual, reintentar: () => { setEstado(null); setIntento(n => n + 1); }};
}

export function useBiblioteca() {
  const [params, setParams] = useSearchParams();
  const clave = params.toString();
  const consulta = useMemo(() => leerConsulta(new URLSearchParams(clave)), [clave]);
  const ultimaConsulta = useRef(consulta);
  useLayoutEffect(() => { ultimaConsulta.current = consulta; }, [consulta]);
  const pedir = useMemo(() => (signal: AbortSignal) => biblioteca.buscar(consulta, signal), [consulta]);
  const resultado = useRecurso(pedir);
  const cambiar = (cambios: Partial<Consulta>, replace = false) => {
    // useSearchParams no acumula sus callbacks entre navegaciones pendientes.
    // Conserva cada cambio inmediato para que dos clics rápidos no se sobrescriban.
    const siguiente = cambiarConsulta(ultimaConsulta.current, cambios);
    ultimaConsulta.current = siguiente;
    setParams(serializar(siguiente), {replace});
  };
  const datos = resultado.datos ?? (resultado.cargando ? resultado.datosAnteriores : undefined);
  return {...resultado, datos, consulta, cambiar, limpiar: () => cambiar(limpiarConsulta(ultimaConsulta.current))};
}
