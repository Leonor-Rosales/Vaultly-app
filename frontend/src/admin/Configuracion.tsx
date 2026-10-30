import ConfiguracionCuenta from '../cuenta/Configuracion';
import { useAdministrador, useActualizarPerfil } from './contexto';
export default function Configuracion() {
  return <ConfiguracionCuenta usuario={useAdministrador()} actualizar={useActualizarPerfil()} ambito="admin" />;
}
