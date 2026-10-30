import { useSyncExternalStore } from 'react';
export type Tema = 'claro' | 'oscuro';
export type AmbitoTema = 'admin' | 'cliente';
const clave = (ambito: AmbitoTema) => `vaultly:${ambito}:tema`;
const evento = 'vaultly:tema-cambiado';
function leer(ambito: AmbitoTema): Tema {
  try { const guardado = localStorage.getItem(clave(ambito)); if (guardado === 'claro' || guardado === 'oscuro') return guardado; } catch { /* Sigue la preferencia del sistema. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}
function suscribir(fn: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', fn); window.addEventListener(evento, fn); media.addEventListener('change', fn);
  return () => { window.removeEventListener('storage', fn); window.removeEventListener(evento, fn); media.removeEventListener('change', fn); };
}
export function guardarTema(tema: Tema, ambito: AmbitoTema = 'admin') {
  try { localStorage.setItem(clave(ambito), tema); } catch { return false; }
  window.dispatchEvent(new Event(evento)); return true;
}
export const useTema = (ambito: AmbitoTema = 'admin') => useSyncExternalStore(suscribir, () => leer(ambito), () => 'claro' as Tema);
