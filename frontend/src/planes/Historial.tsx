import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import ComprobantePago from "./ComprobantePago";
import { obtenerHistorial, type Pago } from "../services/pagos";
import { formatPrecio } from "./planesData";
import "../dashboard/Dashboard.css";
import "./Historial.css";

type Orden = "fecha" | "monto" | "estado";

// "11/09/2026" -> valor comparable
const valorFecha = (fecha: string): number => {
  const [dia, mes, anio] = fecha.split("/").map(Number);
  return new Date(anio, mes - 1, dia).getTime();
};

const ordenar = (pagos: Pago[], orden: Orden): Pago[] =>
  [...pagos].sort((a, b) => {
    if (orden === "monto") return b.monto - a.monto;
    if (orden === "estado") return a.estado.localeCompare(b.estado);
    return valorFecha(b.fecha) - valorFecha(a.fecha);
  });

function Historial() {
  const navigate = useNavigate();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [orden, setOrden] = useState<Orden>("fecha");
  const [seleccionado, setSeleccionado] = useState<Pago | null>(null);

  useEffect(() => {
    obtenerHistorial().then(setPagos);
  }, []);

  return (
    <div className="dashboard-page">
      <Sidebar />

      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1>Historial de pagos</h1>
            <p className="planes-subtitle">
              Consulta tus pagos y renovaciones anteriores
            </p>
          </div>

          <button
            type="button"
            className="upload-button"
            onClick={() => navigate("/planes")}
          >
            <Icon icon="lucide:eye" />
            Ver planes
          </button>
        </div>

        <div className="pagos-toolbar">
          <h2>Pagos</h2>

          <label className="pagos-orden">
            <Icon icon="lucide:list-filter" />
            Ordenar por:
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
            >
              <option value="fecha">Fecha</option>
              <option value="monto">Monto</option>
              <option value="estado">Estado</option>
            </select>
          </label>
        </div>

        <div className="pagos-scroll">
          <div className="pagos-table">
            <div className="pago-row pago-header">
              <span>Fecha</span>
              <span>Código de transacción</span>
              <span>Plan</span>
              <span>Monto</span>
              <span>Método de pago</span>
              <span>Estado</span>
              <span />
            </div>

            {ordenar(pagos, orden).map((pago) => (
              <div className="pago-row" key={pago.id}>
                <span className="pago-fecha">{pago.fecha}</span>
                <span className="pago-codigo">{pago.codigo}</span>
                <span className="pago-plan">{pago.plan}</span>
                <span className="pago-muted">{formatPrecio(pago.monto)}</span>
                <span className="pago-muted">{pago.metodo}</span>
                <span
                  className={`pago-estado ${pago.estado === "Completado" ? "completado" : "pendiente"}`}
                >
                  {pago.estado}
                </span>
                <button
                  type="button"
                  className="pago-descargar"
                  aria-label={`Descargar comprobante ${pago.codigo}`}
                  onClick={() => setSeleccionado(pago)}
                >
                  <Icon icon="lucide:download" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {seleccionado && (
          <ComprobantePago
            pago={seleccionado}
            onClose={() => setSeleccionado(null)}
          />
        )}
      </main>
    </div>
  );
}

export default Historial;
