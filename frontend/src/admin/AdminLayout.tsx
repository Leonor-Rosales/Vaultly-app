import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from './AdminIcon';
import { ApiError, getProfile, logout, type Usuario } from '../services/auth';
import './Admin.css';

export function Marca() {
  return <div className="admin-marca"><span><Icon icon="lucide:vault" /></span>Vaultly</div>;
}
export default function AdminLayout() {
  const [usuario, setUsuario] = useState<Usuario>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let vigente = true;
    getProfile().then(({ usuario }) => { if (vigente) setUsuario(usuario); }).catch(e => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) logout();
      setError(e.message);
    });
    return () => { vigente = false; };
  }, [intento]);
  if (error) return <div className="admin-app admin-loading" role="alert">{error}<button onClick={() => { setError(''); setIntento(intento + 1); }}>Reintentar</button></div>;
  if (!usuario) return <div className="admin-app admin-loading" role="status">Verificando acceso…</div>;
  if (usuario.rol !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <div className="admin-app">
    <button className="admin-menu" aria-expanded={menu} aria-controls="admin-navegacion" onClick={() => setMenu(!menu)}><Icon icon="lucide:menu" /> Menú de administrador</button>
    <aside className={`admin-sidebar ${menu ? 'abierto' : ''}`}>
      <Marca />
      <nav id="admin-navegacion" aria-label="Administración">
        {[
          ['planes', 'lucide:credit-card', 'Planes y facturación'],
          ['administradores', 'lucide:clipboard-list', 'Administradores'],
          ['configuracion', 'lucide:settings', 'Configuración'],
        ].map(([path, icon, nombre]) => <NavLink key={path} to={`/admin/${path}`} onClick={() => setMenu(false)}><Icon icon={icon} />{nombre}</NavLink>)}
        <button onClick={() => { logout(); navigate('/login', { replace: true }); }}><Icon icon="lucide:log-out" />Cerrar sesión</button>
      </nav>
      <div className="admin-identidad"><span className="admin-avatar">{usuario.nombre_completo.split(/\s+/).slice(0, 2).map(p => p[0]).join('')}</span><div>{usuario.nombre_completo}<small>Administrador</small></div></div>
    </aside>
    <main className="admin-main"><Outlet context={{ usuario, actualizar: () => setIntento(i => i + 1) }} /></main>
  </div>;
}
