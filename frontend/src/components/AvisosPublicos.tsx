import { useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
export default function AvisosPublicos() {
  const { pathname } = useLocation();
  const privada = /^\/(admin|dashboard|archivos|biblioteca|planes|configuracion)(\/|$)/.test(pathname);
  return privada ? null : <Toaster position="top-right" toastOptions={{ className: 'vaultly-toast', duration: 3000 }} />;
}
