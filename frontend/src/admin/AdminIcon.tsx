import { Icon } from '@iconify/react';
// Datos locales para que las acciones y el logo no dependan de la API pública de iconos.
const trazos: Record<string, string> = {
  'lucide:vault': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="m6 6 4 4m4 4 4 4M6 18l4-4m4-4 4-4"/>',
  'lucide:credit-card': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  'lucide:clipboard-list': '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6m-6 5h4"/>',
  'lucide:settings': '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  'lucide:log-out': '<path d="M9 3H4v18h5m5-14 5 5-5 5m-6-5h11"/>',
  'lucide:menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
  'lucide:plus': '<path d="M12 5v14M5 12h14"/>',
  'lucide:pencil': '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  'lucide:arrow-right-left': '<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',
};
export default function AdminIcon({ icon }: { icon: string }) {
  return <Icon icon={{ width: 24, height: 24, body: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${trazos[icon] ?? ''}</g>` }} />;
}
