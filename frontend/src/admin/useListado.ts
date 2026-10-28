import { useCallback, useEffect, useState } from 'react';

export function useListado<T>(consultar: () => Promise<T[]>) {
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const cargar = useCallback(() => {
    setError(''); setCargando(true); setRevision(r => r + 1);
  }, []);
  useEffect(() => {
    let vigente = true;
    consultar().then(result => { if (vigente) setDatos(result); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consultar, revision]);
  return { datos, cargando, error, cargar };
}
