import toast from 'react-hot-toast';
import Aviso, { type VarianteAviso } from '../components/Aviso';
function mostrar(variante: VarianteAviso, mensaje: string) {
  return toast.custom(t => <Aviso variante={variante} cerrar={() => toast.dismiss(t.id)}>{mensaje}</Aviso>,
    { id: `admin-${mensaje}`, toasterId: 'admin', duration: variante === 'error' ? 6000 : 4000 });
}
export const avisos = {
  success: (mensaje: string) => mostrar('exito', mensaje),
  error: (mensaje: string) => mostrar('error', mensaje),
  warning: (mensaje: string) => mostrar('advertencia', mensaje),
  info: (mensaje: string) => mostrar('informacion', mensaje),
};
