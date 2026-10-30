import { Link } from 'react-router-dom';
import Icon from './IconoAviso';
import { actualizarConsumo, useConsumo } from '../services/consumo';
import BarraAlmacenamiento from './BarraAlmacenamiento';
import './Avisos.css';

export default function AvisosLimites({ almacenamiento = false, descargas = false, mostrarUso = false }: { almacenamiento?: boolean; descargas?: boolean; mostrarUso?: boolean }) {
  const { consumo, error } = useConsumo();
  return <div className="avisos-limites">
    {error && <section className="aviso-banner" role="status">
      <Icon icon="lucide:wifi-off" /><div><h2>No pudimos actualizar tu consumo</h2><p>{consumo ? 'Mostramos el último consumo conocido. Actualiza para comprobar el espacio disponible.' : 'El consumo no está disponible. Inténtalo de nuevo.'}</p></div>
      <button type="button" className="aviso-enlace" onClick={() => void actualizarConsumo().catch(() => {})}>Reintentar</button>
    </section>}
    {consumo && almacenamiento && <>
      {consumo.alertas.almacenamiento && <section className="aviso-banner" role="status">
        <Icon icon="lucide:hard-drive" /><div>
          <h2>{consumo.alertas.almacenamiento === 'LIMITE' ? consumo.almacenamiento.usados_bytes >= consumo.almacenamiento.cuota_bytes ? 'Almacenamiento lleno' : 'Espacio reservado por cargas en curso' : 'Te queda poco espacio'}</h2>
          <p>{consumo.almacenamiento.reservados_bytes > 0 ? 'Parte de tu espacio está reservado para cargas en curso. Espera a que terminen o libera espacio.' : 'Libera espacio eliminando archivos que ya no necesites o cambia a un plan superior.'}</p>
        </div><Link className="aviso-enlace" to="/planes">Ver planes</Link>
      </section>}
      {mostrarUso && <div className="uso-panel"><BarraAlmacenamiento almacenamiento={consumo.almacenamiento} /></div>}
    </>}
    {consumo && descargas && !consumo.descargas.ilimitadas && consumo.alertas.descargas && <section className="aviso-banner" role="status">
      <Icon icon="lucide:download" /><div>
        <h2>{consumo.alertas.descargas === 'LIMITE' ? 'Límite de descargas agotado' : 'Te quedan pocas descargas'}</h2>
        <p>{consumo.descargas.restantes === 0 ? 'Has utilizado todas tus descargas disponibles.' : `Te quedan ${consumo.descargas.restantes} descargas en este ciclo.`} Se renuevan el {new Date(consumo.descargas.fin).toLocaleDateString('es-GT', { timeZone: 'UTC' })} (UTC). Tus archivos propios se pueden seguir descargando.</p>
      </div><Link className="aviso-enlace" to="/planes">Ver planes</Link>
    </section>}
  </div>;
}
