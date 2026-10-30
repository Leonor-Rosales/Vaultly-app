// Los avisos deben seguir siendo legibles aunque no haya acceso al servicio de iconos.
const trazos = {
  'lucide:check': 'm5 12 4 4L19 6',
  'lucide:arrow-right': 'M4 12h16m-6-6 6 6-6 6',
  'lucide:receipt-text': 'M4 3l2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2v18l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2V3Zm4 6h8m-8 4h8m-8 4h4',
  'lucide:x': 'M6 6l12 12M18 6L6 18',
  'lucide:circle-alert': 'M12 8v4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  'lucide:circle-check': 'm8 12 3 3 5-6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  'lucide:info': 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  'lucide:hard-drive': 'M5 4h14l3 10v6H2v-6L5 4Zm-3 10h20M6 17h.01M10 17h.01',
  'lucide:download': 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  'lucide:trash-2': 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  'lucide:wifi-off': 'm2 2 20 20M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 1 4 1M8 16a6 6 0 0 1 8 0m-4 4h.01',
};
export default function IconoAviso({ icon }: { icon: keyof typeof trazos }) {
  return <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={trazos[icon]} /></svg>;
}
