import { useEffect, useState } from 'react';
import Aviso from '../components/Aviso';
import { ApiError, type Usuario } from '../services/auth';
import { errorCorreo } from '../services/emailPolicy';
import { cancelarCambioCorreo, confirmarCambioCorreo, obtenerCambioCorreo, solicitarCambioCorreo, type SolicitudCorreo } from '../services/cambioCorreo';
import type { AmbitoTema } from './tema';
import { crearAvisos } from './avisos';

type Fallo = { mensaje: string; campo?: 'correo' | 'password' | 'codigo' };
export default function CambioCorreo({ usuario, actualizar, ambito }: { usuario: Usuario; actualizar: (usuario: Usuario) => void; ambito: AmbitoTema }) {
  const avisos = crearAvisos(ambito);
  const [abierto, setAbierto] = useState(false);
  const [solicitud, setSolicitud] = useState<SolicitudCorreo | null>(null);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<Fallo>();
  const [ahora, setAhora] = useState(Date.now);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true;
    obtenerCambioCorreo().then(r => { if (vigente) { setSolicitud(r.solicitud ?? null); if (r.solicitud) setCorreo(r.solicitud.correo); } })
      .catch(() => { if (vigente) setFallo({ mensaje: 'No pudimos consultar la solicitud pendiente. Reintenta antes de continuar.' }); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [revision]);
  useEffect(() => {
    if (!solicitud) return;
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [solicitud]);
  const espera = solicitud ? Math.max(0, Math.ceil((Date.parse(solicitud.reenviar_desde) - ahora) / 1000)) : 0;
  const vencido = solicitud ? Date.parse(solicitud.vence_en) <= ahora : false;
  function mostrarError(e: unknown) {
    const code = e instanceof ApiError ? e.code : undefined;
    const campo = code?.startsWith('PASSWORD_') ? 'password' : code?.startsWith('CORREO_') ? 'correo' : code?.startsWith('CODIGO_') ? 'codigo' : undefined;
    setFallo({ mensaje: e instanceof ApiError ? e.message : 'No se pudo completar la solicitud. Inténtalo de nuevo.', campo });
  }
  const errorCampo = (campo: Fallo['campo']) => fallo && fallo.campo === campo ? <div id={`error-${campo}`}><Aviso variante="error">{fallo.mensaje}</Aviso></div> : null;
  async function enviar() {
    setFallo(undefined);
    const errorDireccion = errorCorreo(correo);
    if (errorDireccion) { setFallo({ campo: 'correo', mensaje: errorDireccion }); return; }
    if (!password) { setFallo({ campo: 'password', mensaje: 'Introduce tu contraseña actual' }); return; }
    setOcupado(true);
    try {
      const r = await solicitarCambioCorreo(correo, password);
      setSolicitud(r.solicitud); setPassword(''); setCodigo(''); setAhora(Date.now()); avisos.success(r.mensaje);
    } catch (e) {
      mostrarError(e);
      try { const r = await obtenerCambioCorreo(); setSolicitud(r.solicitud ?? null); } catch { /* Conserva el error original. */ }
    } finally { setOcupado(false); }
  }
  return <div className="cuenta-correo-perfil">
    <div className="cuenta-perfil-fila"><div><h3>Correo electrónico</h3><p>{usuario.correo_electronico}</p>{solicitud && <small>Verificación pendiente</small>}</div><button type="button" className="cuenta-editar" aria-expanded={abierto || !!solicitud} aria-controls="editar-correo" disabled={ocupado || cargando || !!solicitud} onClick={() => { setAbierto(!abierto); setCorreo(''); setPassword(''); setCodigo(''); setFallo(undefined); }}>{solicitud ? 'Pendiente' : abierto ? 'Cerrar' : 'Editar correo'}</button></div>
    {(abierto || !!solicitud || !!fallo) && <div id="editar-correo" className="cuenta-perfil-editor"><h3>Cambiar correo electrónico</h3>
    <p className="cuenta-ayuda">Tu dirección actual seguirá activa hasta que confirmes el código enviado al nuevo correo.</p>
    {cargando ? <p role="status">Consultando solicitud…</p> : <>
      {fallo && !fallo.campo && <Aviso variante="error">{fallo.mensaje}</Aviso>}
      {fallo && !fallo.campo && !solicitud && <button type="button" className="cuenta-secondary" disabled={ocupado} onClick={() => { setFallo(undefined); setCargando(true); setRevision(r => r + 1); }}>Reintentar consulta</button>}
      <form autoComplete="off" onSubmit={e => { e.preventDefault(); void enviar(); }}>
        <fieldset disabled={ocupado}>
          <label htmlFor="nuevo-correo">Nuevo correo</label>
          <input id="nuevo-correo" type="email" autoComplete="off" required maxLength={150} readOnly={!!solicitud} value={correo} aria-invalid={fallo?.campo === 'correo'} aria-describedby={fallo?.campo === 'correo' ? 'error-correo' : undefined} onChange={e => setCorreo(e.target.value)} />
          {errorCampo('correo')}
          <label htmlFor="password-actual">Contraseña actual{solicitud ? ' (para reenviar)' : ''}</label>
          <input id="password-actual" type="password" autoComplete="new-password" required value={password} aria-invalid={fallo?.campo === 'password'} aria-describedby={fallo?.campo === 'password' ? 'error-password' : undefined} onChange={e => setPassword(e.target.value)} />
          {errorCampo('password')}
          <div className="cuenta-acciones"><button type="submit" disabled={ocupado || espera > 0}>{ocupado ? 'Procesando…' : !solicitud ? 'Enviar código' : espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar código'}</button></div>
        </fieldset>
      </form>
      {solicitud && <div className="cuenta-verificacion">
        {!fallo && <Aviso variante={vencido || solicitud.estado !== 'PENDIENTE' ? 'advertencia' : 'informacion'}>
          {vencido ? 'El código venció. Solicita uno nuevo.' : solicitud.estado === 'FALLIDO' ? 'El envío falló. Tu correo actual no cambió.' : solicitud.estado === 'BLOQUEADO' ? 'Se agotaron los intentos. Solicita otro código.' : solicitud.estado === 'ENVIANDO' ? 'El envío aún no se ha confirmado. Actualiza su estado o solicita otro código cuando termine la espera.' : `Revisa ${solicitud.correo} e introduce el código. Vence en 10 minutos. Intentos restantes: ${solicitud.intentos_restantes}.`}
        </Aviso>}
        {solicitud.estado === 'ENVIANDO' && <button type="button" disabled={ocupado} className="cuenta-secondary" onClick={() => setRevision(r => r + 1)}>Actualizar estado</button>}
        <form onSubmit={async e => {
          e.preventDefault(); setFallo(undefined);
          if (!/^\d{6}$/.test(codigo)) { setFallo({ campo: 'codigo', mensaje: 'Introduce los 6 dígitos del código' }); return; }
          setOcupado(true);
          try {
            const r = await confirmarCambioCorreo(solicitud.id, codigo);
            actualizar(r.usuario); setAbierto(false); setSolicitud(null); setCorreo(''); setPassword(''); setCodigo('');
            if (r.notificado) avisos.success(r.mensaje); else avisos.warning(r.mensaje);
          } catch (e) {
            mostrarError(e);
            try { const r = await obtenerCambioCorreo(); setSolicitud(r.solicitud ?? null); } catch { /* Conserva los datos para reintentar. */ }
          } finally { setOcupado(false); }
        }}>
          <label htmlFor="codigo-correo">Código de verificación</label>
          <input id="codigo-correo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={codigo} disabled={ocupado} aria-invalid={fallo?.campo === 'codigo'} aria-describedby={fallo?.campo === 'codigo' ? 'error-codigo' : undefined} onChange={e => setCodigo(e.target.value)} />
          {errorCampo('codigo')}
          <div className="cuenta-acciones"><button type="submit" disabled={ocupado || vencido || solicitud.estado !== 'PENDIENTE'}>Confirmar nuevo correo</button><button type="button" className="cuenta-secondary" disabled={ocupado} onClick={async () => {
            setOcupado(true); setFallo(undefined);
            try { const r = await cancelarCambioCorreo(); setSolicitud(null); setPassword(''); setCodigo(''); avisos.info(r.mensaje); }
            catch (e) { mostrarError(e); } finally { setOcupado(false); }
          }}>Cancelar solicitud</button></div>
        </form>
      </div>}
    </>}
    </div>}
  </div>;
}
