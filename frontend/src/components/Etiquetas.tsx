import { useId, useRef, useState } from 'react';
import { incluirPendiente } from '../../../shared/etiquetas.mjs';
import './Etiquetas.css';

type Props = {
  etiquetas: string[]; pendiente: string; error: string; disabled?: boolean; ayuda?: string;
  onChange: (valor: string[]) => void; onPendiente: (valor: string) => void;
  onError: (valor: string) => void;
};
export default function Etiquetas({ etiquetas, pendiente, error, disabled, ayuda, onChange, onPendiente, onError }: Props) {
  const id = useId();
  const [escribiendo, setEscribiendo] = useState(false);
  const botonAgregar = useRef<HTMLButtonElement>(null);
  const cerrar = () => { setEscribiendo(false); botonAgregar.current?.focus(); };
  const agregar = () => {
    try {
      onChange(incluirPendiente(etiquetas, pendiente));
      onPendiente(''); onError(''); cerrar();
    } catch (e) { onError((e as Error).message); }
  };
  return <div className="etiquetas-control">
    <div className="etiquetas-encabezado">
      <label id={id + '-label'} htmlFor={id}>Etiquetas <span>Opcional</span></label>
      <span className="etiquetas-contador" aria-label={etiquetas.length + ' de 5 etiquetas'}>{etiquetas.length}/5</span>
    </div>
    <div className="etiquetas-fichas">{etiquetas.map(nombre => <span key={nombre}>
      <span className="etiqueta-nombre">{nombre}</span>
      <button type="button" disabled={disabled} aria-label={'Quitar etiqueta ' + nombre}
        onClick={() => { onChange(etiquetas.filter(n => n !== nombre)); onError(''); }}>×</button>
    </span>)}
      <button ref={botonAgregar} type="button" className="etiquetas-agregar" disabled={disabled}
        aria-label="Añadir etiqueta" title="Añadir etiqueta" aria-expanded={escribiendo || !!pendiente}
        aria-controls={id + '-editor'} onClick={() => setEscribiendo(true)}>+</button>
    </div>
    {(escribiendo || pendiente) && <div id={id + '-editor'} className="etiquetas-editor">
      <input ref={elemento => { elemento?.focus(); }} id={id} value={pendiente} disabled={disabled}
        placeholder="Nueva etiqueta…" aria-invalid={!!error} aria-labelledby={id + '-label'}
        aria-describedby={id + '-ayuda' + (error ? ' ' + id + '-error' : '')} onChange={e => onPendiente(e.target.value)}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); agregar(); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onPendiente(''); onError(''); cerrar(); }
        }} />
      <small id={id + '-ayuda'}>Enter para añadir · Máx. 30 caracteres</small>
    </div>}
    {ayuda && <small>{ayuda}</small>}
    {error && <div id={id + '-error'} role="alert">{error}</div>}
  </div>;
}
