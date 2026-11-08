import { Icon } from '@iconify/react';
import { useState } from 'react';

type Vista = 'tarjetas' | 'lista';

export function useVistaGuardada(clave: string) {
  const [vista, setVista] = useState<Vista>(() => {
    try { return localStorage.getItem(clave) === 'lista' ? 'lista' : 'tarjetas'; }
    catch { return 'tarjetas'; }
  });
  function cambiarVista(valor: Vista) {
    setVista(valor);
    try { localStorage.setItem(clave, valor); } catch { /* Mantener la preferencia en memoria. */ }
  }
  return { vista, cambiarVista };
}

export default function SelectorVista({ vista, cambiarVista, etiqueta }: {
  vista: Vista; cambiarVista: (valor: Vista) => void; etiqueta: string;
}) {
  return <div className="archivos-selector-vista" role="group" aria-label={etiqueta}>
    <button type="button" aria-pressed={vista === 'tarjetas'} onClick={() => cambiarVista('tarjetas')}><Icon icon="lucide:layout-grid" />Tarjetas</button>
    <button type="button" aria-pressed={vista === 'lista'} onClick={() => cambiarVista('lista')}><Icon icon="lucide:list" />Lista</button>
  </div>;
}
