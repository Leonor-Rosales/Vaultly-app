import Sidebar from '../components/Sidebar';
import Configuracion from './Configuracion';
import { useCuenta } from './contexto';
export default function ConfiguracionCliente() {
  const { usuario, actualizar } = useCuenta();
  return <div className="cliente-config-page"><Sidebar /><main className="cliente-config-content"><Configuracion usuario={usuario} actualizar={actualizar} ambito="cliente" /></main></div>;
}
