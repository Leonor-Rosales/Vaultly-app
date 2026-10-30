import { useState } from 'react';
import { requestPasswordReset, ApiError } from '../services/auth';
import { useAdministrador, useActualizarPerfil } from './contexto';
import { guardarAdministrador } from '../services/admin';
import { guardarTema, useTema } from './tema';
import Aviso from '../components/Aviso';
import { avisos } from './avisos';
import CambioCorreo from './CambioCorreo';
export default function Configuracion() {
  const usuario = useAdministrador();
  const tema = useTema();
  const actualizar = useActualizarPerfil();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorNombre, setErrorNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  return <section className="admin-configuracion">
    <header className="admin-heading"><div><h1>Configuración</h1><p className="admin-intro">Personaliza tu espacio y protege tu cuenta</p></div></header>
    <div className="admin-config-grid">
      <section className="admin-card admin-editar-perfil" aria-labelledby="perfil-titulo"><h2 id="perfil-titulo">Editar perfil</h2>
        <p className="admin-ayuda">Administra tu información personal y los datos de tu cuenta.</p>
        <div className="admin-perfil-resumen"><span className="admin-avatar" aria-hidden="true">{usuario.nombre_completo.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('')}</span><div><strong>{usuario.nombre_completo}</strong><span className="admin-badge">Administrador</span></div></div>
        <div className="admin-perfil-datos">
          <div className="admin-perfil-fila"><div><h3>Nombre completo</h3><p>{usuario.nombre_completo}</p></div><button className="admin-editar" disabled={guardando} aria-expanded={editando} aria-controls="editar-nombre" onClick={() => { setNombre(''); setErrorNombre(''); setEditando(!editando); }}>{editando ? 'Cerrar' : 'Editar nombre'}</button></div>
          {editando && <form id="editar-nombre" className="admin-perfil-editor" onSubmit={async e => {
            e.preventDefault(); setErrorNombre('');
            if (!nombre.trim()) { setErrorNombre('Introduce tu nombre completo.'); return; }
            setGuardando(true);
            try { await guardarAdministrador({ nombre_completo: nombre.trim(), correo_electronico: usuario.correo_electronico, activo: true }, usuario.id); actualizar(); setEditando(false); avisos.success('Tu nombre se actualizó.'); }
            catch (e) { setErrorNombre(e instanceof ApiError ? e.message : 'No se pudo guardar el nombre. Inténtalo de nuevo.'); }
            finally { setGuardando(false); }
          }}>
            <label htmlFor="perfil-nombre">Nombre completo</label><input id="perfil-nombre" autoComplete="off" autoFocus required maxLength={150} value={nombre} disabled={guardando} onChange={e => setNombre(e.target.value)} />
            {errorNombre && <Aviso variante="error">{errorNombre}</Aviso>}
            <div className="admin-acciones"><button disabled={guardando || !nombre.trim() || nombre.trim() === usuario.nombre_completo}>{guardando ? 'Guardando…' : 'Guardar nombre'}</button><button type="button" className="admin-secondary" disabled={guardando} onClick={() => setEditando(false)}>Cancelar</button></div>
          </form>}
          <CambioCorreo />
        </div>
      </section>
      <section className="admin-card" aria-labelledby="apariencia-titulo"><span className="admin-seccion-numero">TU ESPACIO</span><h2 id="apariencia-titulo">Apariencia</h2>
        <p className="admin-ayuda">Elige cómo ver el panel. Tu preferencia se guarda en este navegador; inicialmente se utiliza la de tu sistema.</p>
        <fieldset className="admin-temas"><legend>Modo del panel administrativo</legend>{(['claro', 'oscuro'] as const).map(opcion => <label key={opcion} className="admin-tema-opcion">
          <input type="radio" name="tema-admin" checked={tema === opcion} onChange={() => { if (!guardarTema(opcion)) avisos.error('El navegador no permite guardar la preferencia.'); }} />
          <span className={`admin-tema-muestra muestra-${opcion}`} aria-hidden="true"><span /><span /></span><span>Modo {opcion}</span>
        </label>)}</fieldset>
      </section>
      <section className="admin-card admin-seguridad" aria-labelledby="seguridad-titulo"><span className="admin-seccion-numero">ACCESO Y VERIFICACIÓN</span><h2 id="seguridad-titulo">Seguridad</h2>
        <div className="admin-seguridad-bloque"><h3>Cambiar contraseña</h3><p className="admin-ayuda">Enviaremos un enlace de recuperación a tu correo actual para que establezcas una nueva contraseña.</p>
          {error && <Aviso variante="error">{error}</Aviso>}
          <div className="admin-acciones"><button disabled={enviando} onClick={async () => {
            setEnviando(true); setError('');
            try { const r = await requestPasswordReset({ email: usuario.correo_electronico }); avisos.success(r.mensaje); }
            catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo enviar el enlace. Inténtalo de nuevo.'); } finally { setEnviando(false); }
          }}>{enviando ? 'Enviando enlace…' : 'Solicitar cambio de contraseña'}</button></div>
        </div>
      </section>
    </div>
  </section>;
}
