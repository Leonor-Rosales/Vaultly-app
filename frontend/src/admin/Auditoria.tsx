import { useEffect, useState } from 'react';
import Aviso from '../components/Aviso';
import { listarAuditoria, type Auditoria as Resultado, type EventoAuditoria } from '../services/admin';

const acciones: Record<string, string> = {
  PLAN_CREADO: 'Plan creado', PLAN_EDITADO: 'Plan editado', PLAN_ACTIVADO: 'Plan activado', PLAN_DESACTIVADO: 'Plan desactivado',
  PLAN_ARCHIVADO: 'Plan retirado del listado', PLAN_ELIMINADO: 'Plan eliminado sin uso',
  ADMIN_CREADO: 'Administrador creado', ADMIN_EDITADO: 'Administrador editado', ADMIN_ACTIVADO: 'Administrador activado', ADMIN_DESACTIVADO: 'Administrador desactivado',
};
const campos: Record<string, string> = { nombre: 'Nombre del plan', moneda: 'Moneda', precio_mensual: 'Precio habitual', cuota_storage_gb: 'Almacenamiento (GB)', limite_descargas: 'Descargas mensuales', permite_carpetas_publicas: 'Carpetas públicas', activo: 'Activo', version: 'Versión', promocion_tipo: 'Tipo de promoción', promocion_porcentaje: 'Descuento', promocion_precio: 'Precio promocional', promocion_inicio: 'Inicio de promoción', promocion_fin: 'Fin de promoción', inactivo_desde: 'Inactivo desde', archivado_en: 'Retirado del listado el', nombre_completo: 'Nombre', correo_electronico: 'Correo', estado_cuenta: 'Estado de la cuenta' };
const fecha = (valor: string) => new Date(valor).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' });
function valor(dato: unknown, campo: string) {
  if (campo === 'promocion_tipo' && dato != null) return ({ FIJO: 'Precio fijo', PORCENTAJE: 'Porcentaje', GRATIS: 'Período gratis' } as Record<string, string>)[String(dato)] ?? String(dato);
  if (campo === 'promocion_porcentaje' && dato != null) return `${Number(dato)} %`;
  if (dato === null && campo === 'limite_descargas') return 'Ilimitadas';
  if (dato == null) return '—';
  if (typeof dato === 'boolean') return dato ? 'Sí' : 'No';
  if (['promocion_inicio','promocion_fin','inactivo_desde','archivado_en'].includes(campo)) return fecha(String(dato));
  return String(dato);
}
function registro(evento: EventoAuditoria) {
  const d = evento.detalles_json.nuevo ?? evento.detalles_json.anterior;
  return String(d?.nombre ?? d?.nombre_completo ?? 'Registro');
}

export default function Auditoria() {
  const [filtros, setFiltros] = useState({ pagina: 1, accion: '', q: '', desde: '', hasta: '' });
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [errorFechas, setErrorFechas] = useState('');
  const [resultado, setResultado] = useState<Resultado>();
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);
  const [detalle, setDetalle] = useState<EventoAuditoria>();
  useEffect(() => {
    let vigente = true;
    listarAuditoria(filtros).then(d => { if (vigente) setResultado(d); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo consultar la auditoría.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [filtros, revision]);
  const consultar = (cambio: Partial<typeof filtros>) => { setCargando(true); setError(''); setDetalle(undefined); setFiltros(f => ({ ...f, ...cambio })); };
  return <section className="admin-list-page">
    <header className="admin-heading"><div><h1 className="titulo-pagina">Auditoría</h1><p className="admin-intro">Consulta quién modificó los planes y las cuentas administrativas, y revisa los cambios realizados.</p></div></header>
    <form className="admin-auditoria-filtros" role="search" aria-label="Buscar en auditoría" onSubmit={e => {
      e.preventDefault();
      if (desde && hasta && desde > hasta) { setErrorFechas('La fecha Desde no puede ser posterior a Hasta.'); return; }
      setErrorFechas(''); consultar({ q: busqueda.trim(), desde, hasta, pagina: 1 });
    }}>
      <label>Administrador o registro<input type="search" value={busqueda} maxLength={100} placeholder="Nombre del administrador o del plan" onChange={e => setBusqueda(e.target.value)} /></label>
      <label>Acción<select aria-label="Acción" value={filtros.accion} onChange={e => consultar({ accion: e.target.value, pagina: 1 })}><option value="">Todas las acciones</option>{Object.entries(acciones).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}</select></label>
      <label className="admin-auditoria-fecha">Desde<input type="date" min="0001-01-01" max="9998-12-31" value={desde} onChange={e => { setDesde(e.target.value); setErrorFechas(''); }} aria-describedby="auditoria-fechas-ayuda" /></label>
      <label className="admin-auditoria-fecha">Hasta<input type="date" min="0001-01-01" max="9998-12-31" value={hasta} onChange={e => { setHasta(e.target.value); setErrorFechas(''); }} aria-describedby="auditoria-fechas-ayuda" /></label>
      <p id="auditoria-fechas-ayuda" className="admin-ayuda admin-auditoria-fechas-ayuda">Fechas de Guatemala. Se incluye el día completo de inicio y fin; puedes indicar solo una fecha.</p>
      <div className="admin-auditoria-acciones">
      <button type="submit">Buscar</button>
      <button type="button" className="admin-secondary" onClick={() => {
        setBusqueda(''); setDesde(''); setHasta(''); setErrorFechas('');
        consultar({ pagina: 1, accion: '', q: '', desde: '', hasta: '' });
      }}>Limpiar filtros</button>
      </div>
    </form>
    {errorFechas && <Aviso variante="advertencia">{errorFechas}</Aviso>}
    {cargando ? <p role="status">Consultando auditoría…</p> : error ? <Aviso variante="error">{error}<button type="button" onClick={() => { setCargando(true); setError(''); setRevision(r => r + 1); }}>Reintentar</button></Aviso> : !resultado?.items.length ? <Aviso variante="informacion">No hay movimientos que coincidan con esta búsqueda.</Aviso> : <>
      <p className="admin-ayuda">{resultado.total} movimientos · Fechas y horas de Guatemala</p>
      <div className="admin-table-scroll" tabIndex={0} aria-label="Movimientos de auditoría"><table><thead><tr>{['Fecha y hora','Administrador','Acción','Registro','Detalle'].map(c => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{resultado.items.map(e => <tr key={e.id}>
        <td><time dateTime={e.fecha_hora}>{fecha(e.fecha_hora)}</time></td><td>{e.administrador}</td><td><span className="admin-badge">{acciones[e.codigo] ?? e.codigo}</span></td><td>{registro(e)}</td>
        <td><button type="button" className="admin-secondary" aria-expanded={detalle?.id === e.id} aria-controls="auditoria-detalle" onClick={() => setDetalle(d => d?.id === e.id ? undefined : e)}>Ver cambios</button></td>
      </tr>)}</tbody></table></div>
      <nav className="admin-auditoria-paginacion" aria-label="Páginas de auditoría"><button type="button" className="admin-secondary" disabled={filtros.pagina === 1} onClick={() => consultar({ pagina: filtros.pagina - 1 })}>Anterior</button><span>Página {filtros.pagina} de {Math.max(1, Math.ceil(resultado.total / resultado.por_pagina))}</span><button type="button" className="admin-secondary" disabled={filtros.pagina * resultado.por_pagina >= resultado.total} onClick={() => consultar({ pagina: filtros.pagina + 1 })}>Siguiente</button></nav>
    </>}
    <div id="auditoria-detalle">{detalle && <section className="admin-card admin-auditoria-detalle" aria-label="Detalle de cambios">
      <h2>{registro(detalle)}</h2><p className="admin-ayuda">{acciones[detalle.codigo]} · {detalle.administrador} · {fecha(detalle.fecha_hora)}</p>
      {detalle.codigo === 'PLAN_ARCHIVADO' && <p className="admin-ayuda">Retiro automático después de 30 días inactivo. Los pagos y suscripciones conservan su historial.</p>}
      {detalle.codigo === 'PLAN_ELIMINADO' && <p className="admin-ayuda">Eliminado automáticamente después de 30 días inactivo, sin pagos ni suscripciones asociados.</p>}
      <div className="admin-table-scroll" tabIndex={0}><table><thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead><tbody>{Object.entries(campos).filter(([c]) => c in (detalle.detalles_json.anterior ?? {}) || c in (detalle.detalles_json.nuevo ?? {})).map(([c, etiqueta]) => <tr key={c}><th scope="row">{etiqueta}</th><td>{valor(detalle.detalles_json.anterior?.[c], c)}</td><td>{valor(detalle.detalles_json.nuevo?.[c], c)}</td></tr>)}</tbody></table></div>
      <button type="button" className="admin-secondary" onClick={() => setDetalle(undefined)}>Cerrar detalle</button>
    </section>}</div>
  </section>;
}
