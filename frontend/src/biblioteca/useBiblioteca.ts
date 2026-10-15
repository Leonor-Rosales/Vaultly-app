import { useEffect, useMemo, useState } from 'react';
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
  return {datos: actual?.datos, error: actual?.error, cargando: !actual, reintentar: () => { setEstado(null); setIntento(n => n + 1); }};
}

export function useBiblioteca() {
  const [params, setParams] = useSearchParams();
  const clave = params.toString();
  const consulta = useMemo(() => leerConsulta(new URLSearchParams(clave)), [clave]);
  const pedir = useMemo(() => (signal: AbortSignal) => biblioteca.buscar(consulta, signal), [consulta]);
  const resultado = useRecurso(pedir);
  const cambiar = (cambios: Partial<Consulta>, replace = false) => {
    setParams(actual => serializar(cambiarConsulta(leerConsulta(actual), cambios)), {replace});
  };
  return {...resultado, consulta, cambiar, limpiar: () => setParams(serializar(limpiarConsulta(consulta)))};
}
