import toast from 'react-hot-toast';
import Aviso, { type VarianteAviso } from '../components/Aviso';
function mostrar(ambito: string, variante: VarianteAviso, mensaje: string) {
  return toast.custom(t => <Aviso variante={variante} cerrar={() => toast.dismiss(t.id, ambito)}>{mensaje}</Aviso>,
    { id: `${ambito}-${mensaje}`, toasterId: ambito, duration: variante === 'error' ? 6000 : 4000 });
}
export const crearAvisos = (ambito: string) => ({
  success: (mensaje: string) => mostrar(ambito, 'exito', mensaje),
  error: (mensaje: string) => mostrar(ambito, 'error', mensaje),
  warning: (mensaje: string) => mostrar(ambito, 'advertencia', mensaje),
  info: (mensaje: string) => mostrar(ambito, 'informacion', mensaje),
});
export const avisosCliente = crearAvisos('cliente');
