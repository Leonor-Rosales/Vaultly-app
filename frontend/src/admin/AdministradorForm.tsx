import { useState } from 'react';
import { guardarAdministrador, type Administrador } from '../services/admin';
import { emailValido, errorPassword } from '../services/passwordPolicy';
import PasswordRequirements from '../components/PasswordRequirements';
import { avisos as toast } from './avisos';
import Aviso from '../components/Aviso';
import { useConfirmar } from './confirmacionContexto';
export default function AdministradorForm({ usuario, propio, cerrar }: { usuario?: Administrador; propio: boolean; cerrar: (guardado?: boolean) => void }) {
  const confirmar = useConfirmar();
  const [nombre, setNombre] = useState(usuario?.nombre_completo ?? '');
  const [correo, setCorreo] = useState(usuario?.correo_electronico ?? '');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [activo, setActivo] = useState(usuario ? usuario.estado_cuenta === 'ACTIVO' : true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  return <form className="admin-card admin-user-form" onSubmit={async e => {
    e.preventDefault(); setError('');
    const fallo = !nombre.trim() ? 'El nombre es obligatorio' : !emailValido(correo.trim()) ? 'Correo no válido' : !usuario ? errorPassword(password, confirmacion) : '';
    if (fallo) { setError(fallo); return; }
    if (usuario && activo !== (usuario.estado_cuenta === 'ACTIVO') && !(await confirmar(`¿${activo ? 'Activar' : 'Desactivar'} esta cuenta?`))) return;
    setGuardando(true);
    try { await guardarAdministrador({ nombre_completo: nombre.trim(), correo_electronico: correo.trim(), activo, ...(!usuario ? { password } : {}) }, usuario?.id); toast.success('Administrador guardado'); cerrar(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); } finally { setGuardando(false); }
  }}>
    <h2>{usuario ? 'Editar administrador' : 'Crear administrador'}</h2>
    <fieldset disabled={guardando}>
      <label>Nombre completo<input required maxLength={150} autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label>Correo electrónico<input required readOnly={!!usuario} type="email" maxLength={150} autoComplete="email" value={correo} onChange={e => setCorreo(e.target.value)} /></label>
      {usuario && <p className="admin-ayuda">El titular puede cambiar su correo con verificación desde Configuración.</p>}
      {!usuario && <><label>Contraseña<input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><PasswordRequirements id="admin-password" password={password} /><label>Confirmar contraseña<input required type="password" autoComplete="new-password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} /></label></>}
      <label className="admin-check"><input type="checkbox" disabled={propio} checked={activo} onChange={e => setActivo(e.target.checked)} />Cuenta activa</label>
      {propio && <p>Para conservar tu acceso, no puedes desactivar tu propia cuenta.</p>}
      {error && <Aviso variante="error">{error}</Aviso>}
      <div className="admin-form-actions"><button className="admin-secondary" type="button" onClick={() => cerrar()}>Cancelar</button><button type="submit">{guardando ? 'Guardando…' : 'Guardar administrador'}</button></div>
    </fieldset>
  </form>;
}
