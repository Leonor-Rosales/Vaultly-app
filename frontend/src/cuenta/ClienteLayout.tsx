import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ApiError, getProfile, logout, type Usuario } from '../services/auth';
import { CuentaContexto } from './contexto';
import { useTema } from './tema';
import Aviso from '../components/Aviso';
import Sidebar from '../components/Sidebar';
import { ProveedorAvisos } from '../components/Avisos';
import './Tema.css';
import './Cliente.css';

export default function ClienteLayout() {
  const tema = useTema('cliente');
  const [usuario, setUsuario] = useState<Usuario>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    let vigente = true;
    getProfile().then(({ usuario }) => { if (vigente) {
      setUsuario(usuario);
      try { localStorage.setItem('usuario', JSON.stringify(usuario)); } catch { /* Se conserva en memoria. */ }
    } }).catch(e => { if (vigente) {
      if (e instanceof ApiError && e.status === 401) logout();
      setError(e.message);
    } });
    return () => { vigente = false; };
  }, [intento]);
  if (usuario && usuario.rol !== 'CLIENTE') return <Navigate to="/admin/planes" replace />;
  return <div className="cuenta-theme cliente-app" data-tema={tema}>
    {!usuario ? error ? <Aviso variante="error">{error}<button onClick={() => { setError(''); setIntento(i => i + 1); }}>Reintentar</button></Aviso> : <p role="status">Verificando tu cuenta…</p> :
      <CuentaContexto.Provider value={{ usuario, actualizar: perfil => {
        setUsuario(perfil);
        try { localStorage.setItem('usuario', JSON.stringify(perfil)); } catch { /* Se conserva en memoria. */ }
      } }}>
        <ProveedorAvisos>
        <Toaster toasterId="cliente" position="top-right" />
        <button className="cliente-menu" aria-expanded={menu} aria-controls="cliente-navegacion-movil" onClick={() => setMenu(!menu)}>☰ Menú</button>
        {menu && <div id="cliente-navegacion-movil" className="cliente-menu-panel" onClick={() => setMenu(false)}><Sidebar /></div>}
        <div key={pathname} className="cliente-vista"><Outlet /></div>
        </ProveedorAvisos>
      </CuentaContexto.Provider>}
  </div>;
}
