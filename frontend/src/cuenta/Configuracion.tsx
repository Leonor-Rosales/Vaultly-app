import { useState } from 'react';
import { requestPasswordReset, ApiError, type Usuario } from '../services/auth';
import { guardarNombre } from '../services/cuenta';
import { guardarTema, useTema, type AmbitoTema } from './tema';
import Aviso from '../components/Aviso';
import { crearAvisos } from './avisos';
import './Configuracion.css';
import CambioCorreo from './CambioCorreo';
export default function Configuracion({ usuario, actualizar, ambito }: { usuario: Usuario; actualizar: (usuario: Usuario) => void; ambito: AmbitoTema }) {
  const tema = useTema(ambito);
  const avisos = crearAvisos(ambito);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorNombre, setErrorNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  return <section className="cuenta-configuracion">
    <header className="cuenta-heading"><div><h1>Configuración</h1><p className="cuenta-intro">Personaliza tu espacio y protege tu cuenta</p></div></header>
    <div className="cuenta-config-grid">
      <section className="cuenta-card cuenta-editar-perfil" aria-labelledby="perfil-titulo"><h2 id="perfil-titulo">Editar perfil</h2>
        <p className="cuenta-ayuda">Administra tu información personal y los datos de tu cuenta.</p>
        <div className="cuenta-perfil-resumen"><span className="cuenta-avatar" aria-hidden="true">{usuario.nombre_completo.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('')}</span><div><strong>{usuario.nombre_completo}</strong><span className="cuenta-badge">{usuario.rol === 'ADMIN' ? 'Administrador' : 'Cliente'}</span></div></div>
        <div className="cuenta-perfil-datos">
          <div className="cuenta-perfil-fila"><div><h3>Nombre completo</h3><p>{usuario.nombre_completo}</p></div><button className="cuenta-editar" disabled={guardando} aria-expanded={editando} aria-controls="editar-nombre" onClick={() => { setNombre(''); setErrorNombre(''); setEditando(!editando); }}>{editando ? 'Cerrar' : 'Editar nombre'}</button></div>
          {editando && <form id="editar-nombre" className="cuenta-perfil-editor" onSubmit={async e => {
            e.preventDefault(); setErrorNombre('');
            if (!nombre.trim()) { setErrorNombre('Introduce tu nombre completo.'); return; }
            setGuardando(true);
            try { const resultado = await guardarNombre(nombre.trim()); actualizar(resultado.usuario); setEditando(false); avisos.success('Tu nombre se actualizó.'); }
            catch (e) { setErrorNombre(e instanceof ApiError ? e.message : 'No se pudo guardar el nombre. Inténtalo de nuevo.'); }
            finally { setGuardando(false); }
          }}>
            <label htmlFor="perfil-nombre">Nombre completo</label><input id="perfil-nombre" autoComplete="off" autoFocus required maxLength={150} value={nombre} disabled={guardando} onChange={e => setNombre(e.target.value)} />
            {errorNombre && <Aviso variante="error">{errorNombre}</Aviso>}
            <div className="cuenta-acciones"><button disabled={guardando || !nombre.trim() || nombre.trim() === usuario.nombre_completo}>{guardando ? 'Guardando…' : 'Guardar nombre'}</button><button type="button" className="cuenta-secondary" disabled={guardando} onClick={() => setEditando(false)}>Cancelar</button></div>
          </form>}
          <CambioCorreo usuario={usuario} actualizar={actualizar} ambito={ambito} />
        </div>
      </section>
      <section className="cuenta-card" aria-labelledby="apariencia-titulo"><span className="cuenta-seccion-numero">TU ESPACIO</span><h2 id="apariencia-titulo">Apariencia</h2>
        <p className="cuenta-ayuda">Elige cómo ver el panel. Tu preferencia se guarda en este navegador; inicialmente se utiliza la de tu sistema.</p>
        <fieldset className="cuenta-temas"><legend>Modo de apariencia</legend>{(['claro', 'oscuro'] as const).map(opcion => <label key={opcion} className="cuenta-tema-opcion">
          <input type="radio" name={`tema-${ambito}`} checked={tema === opcion} onChange={() => { if (!guardarTema(opcion, ambito)) avisos.error('El navegador no permite guardar la preferencia.'); }} />
          <span className={`cuenta-tema-muestra muestra-${opcion}`} aria-hidden="true"><span /><span /></span><span>Modo {opcion}</span>
        </label>)}</fieldset>
      </section>
      <section className="cuenta-card cuenta-seguridad" aria-labelledby="seguridad-titulo"><span className="cuenta-seccion-numero">ACCESO Y VERIFICACIÓN</span><h2 id="seguridad-titulo">Seguridad</h2>
        <div className="cuenta-seguridad-bloque"><h3>Cambiar contraseña</h3><p className="cuenta-ayuda">Enviaremos un enlace de recuperación a tu correo actual para que establezcas una nueva contraseña.</p>
          {error && <Aviso variante="error">{error}</Aviso>}
          <div className="cuenta-acciones"><button disabled={enviando} onClick={async () => {
            setEnviando(true); setError('');
            try { const r = await requestPasswordReset({ email: usuario.correo_electronico }); avisos.success(r.mensaje); }
            catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo enviar el enlace. Inténtalo de nuevo.'); } finally { setEnviando(false); }
          }}>{enviando ? 'Enviando enlace…' : 'Solicitar cambio de contraseña'}</button></div>
        </div>
      </section>
    </div>
  </section>;
}
