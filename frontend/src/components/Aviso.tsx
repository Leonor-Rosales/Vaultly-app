import type { ReactNode } from 'react';
export type VarianteAviso = 'exito' | 'advertencia' | 'error' | 'informacion';
const iconos = { exito: '✓', advertencia: '!', error: '×', informacion: 'i' };
const titulos = { exito: 'Éxito', advertencia: 'Advertencia', error: 'Error', informacion: 'Información' };
export default function Aviso({ variante, children, cerrar }: { variante: VarianteAviso; children: ReactNode; cerrar?: () => void }) {
  return <div className={`vaultly-aviso aviso-${variante}`} role={variante === 'error' ? 'alert' : 'status'}>
    <span className="aviso-icono" aria-hidden="true">{iconos[variante]}</span>
    <div><strong className="aviso-titulo">{titulos[variante]}</strong><div>{children}</div></div>
    {cerrar && <button type="button" className="aviso-cerrar" onClick={cerrar} aria-label="Cerrar aviso">×</button>}
  </div>;
}
