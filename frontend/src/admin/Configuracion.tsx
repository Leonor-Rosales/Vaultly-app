import { useState } from 'react';
import { requestPasswordReset } from '../services/auth';
import { useAdministrador } from './contexto';
export default function Configuracion() {
  const usuario = useAdministrador();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  return <section><header className="admin-heading"><h1>Configuración</h1></header><p className="admin-intro">Tu perfil y la seguridad de tu cuenta</p><div className="admin-card admin-profile"><h2>Perfil del administrador</h2><dl><dt>Nombre</dt><dd>{usuario.nombre_completo}</dd><dt>Correo electrónico</dt><dd>{usuario.correo_electronico}</dd><dt>Rol</dt><dd>Administrador</dd></dl><h2>Contraseña</h2><p>Te enviaremos un enlace a tu correo para establecer una nueva contraseña.</p><button disabled={enviando} onClick={async () => {
    setEnviando(true); setMensaje(''); setError('');
    try { const r = await requestPasswordReset({ email: usuario.correo_electronico }); setMensaje(r.mensaje); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar el correo'); } finally { setEnviando(false); }
  }}>{enviando ? 'Enviando…' : 'Solicitar cambio de contraseña'}</button>{mensaje && <p role="status">{mensaje}</p>}{error && <p className="admin-error" role="alert">{error}</p>}</div></section>;
}
