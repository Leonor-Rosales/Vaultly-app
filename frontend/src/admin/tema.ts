import { useSyncExternalStore } from 'react';
export type Tema = 'claro' | 'oscuro';
const clave = 'vaultly:admin:tema';
const evento = 'vaultly:admin:tema-cambiado';
function leer(): Tema {
  try { const guardado = localStorage.getItem(clave); if (guardado === 'claro' || guardado === 'oscuro') return guardado; } catch { /* Sigue la preferencia del sistema. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}
function suscribir(fn: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', fn); window.addEventListener(evento, fn); media.addEventListener('change', fn);
  return () => { window.removeEventListener('storage', fn); window.removeEventListener(evento, fn); media.removeEventListener('change', fn); };
}
export function guardarTema(tema: Tema) {
  try { localStorage.setItem(clave, tema); } catch { return false; }
  window.dispatchEvent(new Event(evento)); return true;
}
export const useTema = () => useSyncExternalStore(suscribir, leer, () => 'claro' as Tema);
