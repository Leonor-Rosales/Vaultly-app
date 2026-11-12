import { useState } from 'react';
import Aviso from './Aviso';

type Props = { cuenta: string; id: string; children: string };

// Solo para explicaciones permanentes; no oculta errores ni avisos de seguridad.
export default function AvisoInformativo(props: Props) {
  return <Informacion key={JSON.stringify([props.cuenta, props.id, props.children])} {...props} />;
}

function Informacion({ cuenta, id, children }: Props) {
  const clave = `vaultly:aviso-leido:${encodeURIComponent(cuenta)}:${encodeURIComponent(id)}`;
  const [cerrado, setCerrado] = useState(() => {
    try { return localStorage.getItem(clave) === children; }
    catch { return false; }
  });
  if (cerrado) return null;
  return <Aviso variante="informacion" cerrar={() => {
    setCerrado(true);
    try { localStorage.setItem(clave, children); }
    catch { /* Si el navegador bloquea el almacenamiento, se cierra solo en esta vista. */ }
  }}>{children}</Aviso>;
}
