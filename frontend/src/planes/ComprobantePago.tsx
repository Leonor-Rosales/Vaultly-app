import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import type { Pago } from "../services/pagos";
import { formatPrecio } from "./planesData";
import "./ComprobantePago.css";

interface Props {
  pago: Pago;
  onClose: () => void;
}

// Datos del cliente guardados al iniciar sesión (si existen). Solo se muestran textos.
const datosCliente = (): { nombre: string; correo: string } => {
  try {
    const u = JSON.parse(localStorage.getItem("usuario") ?? "{}");
    const texto = (...claves: string[]): string => {
      for (const c of claves) if (typeof u?.[c] === "string" && u[c].trim()) return u[c].trim();
      return "";
    };
    return {
      nombre: texto("nombre", "nombres", "nombre_completo", "name"),
      correo: texto("correo", "email"),
    };
  } catch {
    return { nombre: "", correo: "" };
  }
};

function ComprobantePago({ pago, onClose }: Props) {
  const cliente = datosCliente();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
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
    ["Fecha", pago.fecha],
    ...(cliente.nombre ? ([["Cliente", cliente.nombre]] as [string, string][]) : []),
    ...(cliente.correo ? ([["Correo", cliente.correo]] as [string, string][]) : []),
    ["Plan contratado", pago.plan],
    ["Método de pago", pago.metodo],
    ["Estado", pago.estado],
  ];

  return createPortal(
    <div className="cp-overlay" onClick={onClose}>
      <div
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
        <p className="cp-sub">Suscripción mensual a Vaultly</p>

        <dl className="cp-detalle">
          {filas.map(([etiqueta, valor]) => (
            <div className="cp-fila" key={etiqueta}>
              <dt>{etiqueta}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="cp-total">
          <span>Total pagado</span>
          <strong>{formatPrecio(pago.monto)}</strong>
        </div>

        <p className="cp-nota">
          Este comprobante corresponde a un pago simulado dentro de Vaultly. No se
          realizó ningún cargo real y no tiene validez fiscal.
        </p>

        <div className="cp-acciones">
          <button type="button" className="cp-btn cp-btn-sec" onClick={onClose}>
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
