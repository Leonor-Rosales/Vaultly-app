import { useState } from 'react';
import Icon from './IconoAviso';
import { avisosCliente as toast } from '../cuenta/avisos';
import type { Consumo } from '../services/consumo';
import { configurarRenovacion } from '../services/pagos';
import '../planes/Renovacion.css';

// Días antes del vencimiento en los que se pregunta si se quiere renovar.
const DIAS_AVISO = 3;
const DIA_MS = 24 * 60 * 60 * 1000;

export default function AvisoRenovacion({ consumo }: { consumo: Consumo }) {
  const [guardando, setGuardando] = useState(false);
  const suscripcion = consumo.suscripcion;
  if (!suscripcion) return null;
  const faltan = new Date(suscripcion.fecha_fin).getTime() - Date.now();
  if (faltan <= 0 || faltan > DIAS_AVISO * DIA_MS) return null;

  const automatica = suscripcion.renovacion_automatica;
  const fecha = new Date(suscripcion.fecha_fin).toLocaleDateString('es-GT');
  const elegir = async (renovar: boolean) => {
    setGuardando(true);
    try {
      await configurarRenovacion(renovar);
      toast.success(renovar ? 'Tu plan se renovará automáticamente' : 'Tu plan no se renovará');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la renovación.');
    } finally { setGuardando(false); }
  };

  return <section className="aviso-banner" role="status">
    <Icon icon="lucide:receipt-text" /><div>
      <h2>Tu plan {consumo.plan.nombre} vence el {fecha}</h2>
      <p>{automatica ? 'Se renovará automáticamente con un pago simulado.' : 'Si no lo renuevas, volverás al plan Free.'}</p>
    </div>
    <div className="aviso-acciones">
      <button type="button" className="aviso-enlace" aria-pressed={automatica} disabled={guardando || automatica} onClick={() => void elegir(true)}>Renovar</button>
      <button type="button" className="aviso-enlace" aria-pressed={!automatica} disabled={guardando || !automatica} onClick={() => void elegir(false)}>No renovar</button>
    </div>
  </section>;
}