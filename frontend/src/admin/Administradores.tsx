import { useState } from 'react';
import Icon from './AdminIcon';
import toast from 'react-hot-toast';
import { guardarAdministrador, listarAdministradores, type Administrador } from '../services/admin';
import { useAdministrador, useActualizarPerfil } from './contexto';
import AdministradorForm from './AdministradorForm';
import { useListado } from './useListado';
export default function Administradores() {
  const actual = useAdministrador();
  const actualizarPerfil = useActualizarPerfil();
  const { datos: usuarios, cargando, error, cargar } = useListado(listarAdministradores);
  const [busqueda, setBusqueda] = useState('');
  const [formulario, setFormulario] = useState<Administrador | 'nuevo' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (formulario) return <AdministradorForm usuario={formulario === 'nuevo' ? undefined : formulario} propio={formulario !== 'nuevo' && formulario.id === actual.id} cerrar={guardado => { setFormulario(null); if (guardado) { void cargar(); actualizarPerfil(); } }} />;
  const resultados = usuarios.filter(u => `${u.nombre_completo} ${u.correo_electronico}`.toLowerCase().includes(busqueda.toLowerCase()));
  return <section><header className="admin-heading"><h1>Administradores</h1><button onClick={() => setFormulario('nuevo')}><Icon icon="lucide:plus" />Crear administrador</button></header><p className="admin-intro">Gestiona las cuentas con acceso a la administración de Vaultly</p>
    <label className="admin-search">Buscar administradores<input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o correo electrónico" /></label>
    {cargando ? <p role="status">Cargando administradores…</p> : error ? <div role="alert" className="admin-error">{error}<button onClick={() => void cargar()}>Reintentar</button></div> : !resultados.length ? <p>No se encontraron administradores.</p> : <div className="admin-table-scroll" tabIndex={0} aria-label="Administradores"><table><thead><tr>{['Nombre', 'Correo', 'Estado', 'Fecha de creación', 'Acciones'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{resultados.map(u => <tr key={u.id}><td>{u.nombre_completo}{u.id === actual.id ? ' (Tú)' : ''}</td><td>{u.correo_electronico}</td><td><span className={`admin-badge ${u.estado_cuenta === 'ACTIVO' ? '' : 'inactivo'}`}>{u.estado_cuenta === 'ACTIVO' ? 'Activo' : 'Inactivo'}</span></td><td>{new Date(u.created_at).toLocaleDateString('es-GT')}</td><td className="admin-row-actions">
      <button aria-label={`Editar ${u.nombre_completo}`} onClick={() => setFormulario(u)}><Icon icon="lucide:pencil" /></button>
      <button disabled={ocupado || u.id === actual.id} aria-label={`${u.estado_cuenta === 'ACTIVO' ? 'Desactivar' : 'Activar'} ${u.nombre_completo}`} onClick={async () => {
        const activo = u.estado_cuenta !== 'ACTIVO';
        if (!window.confirm(`¿${activo ? 'Activar' : 'Desactivar'} a ${u.nombre_completo}?`)) return;
        setOcupado(true);
        try { await guardarAdministrador({ nombre_completo: u.nombre_completo, correo_electronico: u.correo_electronico, activo }, u.id); toast.success('Estado actualizado'); await cargar(); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado'); } finally { setOcupado(false); }
      }}><Icon icon="lucide:arrow-right-left" /></button></td></tr>)}</tbody></table></div>}
  </section>;
}
