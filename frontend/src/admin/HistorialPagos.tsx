import Aviso from '../components/Aviso';
import { listarPagos } from '../services/admin';
import { useListado } from './useListado';
import { formatPrecio } from '../planes/planesData';

const fecha = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala' });

export default function HistorialPagos() {
  const { datos, cargando, error, cargar } = useListado(listarPagos);
  return <section className="admin-list-page">
    <header className="admin-heading"><div><h1 className="titulo-pagina">Historial de pagos</h1><p className="admin-intro">Consulta las compras y el estado de los pagos de tus suscriptores.</p></div></header>
    {cargando ? <p role="status">Cargando pagos…</p>
      : error ? <Aviso variante="error">{error}<button onClick={cargar}>Reintentar</button></Aviso>
      : !datos.length ? <p>Aún no hay pagos registrados.</p>
      : <div className="admin-table-scroll" tabIndex={0} aria-label="Historial de pagos">
        <table>
          <thead><tr>{['Fecha y hora (Guatemala)', 'Comprador', 'Correo', 'Plan adquirido', 'Monto', 'Estado'].map(columna =>
            <th scope="col" key={columna}>{columna}</th>)}</tr></thead>
          <tbody>{datos.map(pago => <tr key={pago.id}>
            <td><time dateTime={pago.creado_en}>{fecha.format(new Date(pago.creado_en))}</time></td>
            <td>{pago.nombre_completo}</td><td>{pago.correo_electronico}</td>
            <td>{pago.plan_nombre}</td><td>{formatPrecio(Number(pago.monto))}</td>
            <td>{pago.estado === 'COMPLETADO' ? 'Completado' : 'Pendiente'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
  </section>;
}
