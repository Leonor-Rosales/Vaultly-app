import { useTema } from '../cuenta/tema';
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import type { Pago } from "../services/pagos";
import "./ComprobantePago.css";

interface Props {
  pago: Pago;
  onClose: () => void;
}

function ComprobantePago({ pago, onClose }: Props) {
  const datos = pago.comprobante;
  const sheet = useRef<HTMLDivElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const tema = useTema('cliente');
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: 'short', year: 'numeric' });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === 'Tab') {
        const botones = sheet.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!botones?.length) return;
        const primero = botones[0], ultimo = botones[botones.length - 1];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => { window.removeEventListener("keydown", alTeclear); document.body.style.overflow = overflow; anterior?.focus(); };
  }, [onClose]);

  // El navegador usa el título del documento como nombre sugerido del PDF.
  const descargar = () => {
    const titulo = document.title;
    const restaurar = () => {
      document.title = titulo;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    document.title = `Comprobante-${pago.codigo}`;
    window.print();
  };

  const filas: [string, string][] = [
    ["Código de transacción", pago.codigo],
    ["Fecha de compra (Guatemala)", pago.fechaISO ? new Date(pago.fechaISO).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' }) : pago.fecha],
    ["Método de pago", pago.metodo],
    ["Estado", pago.estado],
  ];

  return createPortal(
    <div className="cp-overlay cuenta-theme cliente-colores" data-tema={tema} onClick={onClose}>
      <div
        ref={sheet}
        className="cp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Comprobante ${pago.codigo}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cp-head">
          <div className="cp-brand">
            <span className="cp-logo">
              <Icon icon="lucide:vault" />
            </span>
            Vaultly
          </div>
          <span className="cp-simulado">Pago simulado</span>
        </header>

        <h2 className="cp-title">Comprobante de pago</h2>
        <p className="cp-sub">Suscripción mensual · Importes en quetzales (GTQ)</p>

        <section className="cp-seccion" aria-labelledby="cp-compra">
        <h3 id="cp-compra">Datos de la compra</h3>
        <dl className="cp-detalle">
          {filas.map(([etiqueta, valor]) => (
            <div className="cp-fila" key={etiqueta}>
              <dt>{etiqueta}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
        </section>

        <section className="cp-seccion" aria-labelledby="cp-cliente">
          <h3 id="cp-cliente">Cliente</h3>
          {datos ? <dl className="cp-detalle">
            <div className="cp-fila"><dt>Nombre</dt><dd>{datos.cliente.nombre}</dd></div>
            <div className="cp-fila"><dt>Correo</dt><dd>{datos.cliente.correo}</dd></div>
          </dl> : <p className="cp-legado">Los datos del cliente no se guardaron en este pago.</p>}
        </section>

        <section className="cp-seccion" aria-labelledby="cp-plan">
          <h3 id="cp-plan">Suscripción adquirida</h3>
          <div className="cp-plan">
            <strong className="cp-plan-nombre">{pago.plan}</strong>
            {datos ? <>
              <dl className="cp-beneficios">
                <div><dt>Almacenamiento</dt><dd>{datos.almacenamientoGb} GB</dd></div>
                <div><dt>Descargas mensuales</dt><dd>{datos.descargasMensuales === null ? 'Ilimitadas' : datos.descargasMensuales}</dd></div>
              </dl>
              <dl className="cp-vigencia">
                <div><dt>Inicio</dt><dd>{fecha(datos.inicio)}</dd></div>
                <div><dt>Vencimiento</dt><dd>{fecha(datos.fin)}</dd></div>
              </dl>
              {datos.promocion && <p className="cp-legado">Promoción aplicada al período completo. Precio habitual de renovación: GTQ {datos.promocion.precioHabitual.toFixed(2)} / mes. Renovación automática: {datos.renovacionAutomatica ? 'aceptada' : 'desactivada'}.</p>}
            </> : <p className="cp-legado">La capacidad, las descargas y el período contratado no se guardaron en este pago histórico.</p>}
          </div>
        </section>

        <div className="cp-total">
          <span>{pago.estado === 'Completado' ? 'Total pagado' : 'Total pendiente'}</span>
          <strong>{new Intl.NumberFormat('es-GT', { style: 'currency', currency: datos?.moneda ?? 'GTQ', currencyDisplay: 'code' }).format(pago.monto)}</strong>
        </div>

        <p className="cp-nota">
          Este comprobante corresponde a un pago simulado dentro de Vaultly. No se
          realizó ningún cargo real y no tiene validez fiscal.
        </p>

        <div className="cp-acciones">
          <button ref={cerrar} type="button" className="cp-btn cp-btn-sec" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="cp-btn cp-btn-main" onClick={descargar}>
            <Icon icon="lucide:download" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ComprobantePago;
