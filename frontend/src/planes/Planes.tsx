import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { obtenerPlanActual, type PlanActual } from "../services/pagos";
import { PLANES, formatPrecio, textoDescargas } from "./planesData";
import "../dashboard/Dashboard.css";
import "./Planes.css";

function Planes() {
  const navigate = useNavigate();
  const [actual, setActual] = useState<PlanActual | null>(null);

  useEffect(() => {
    obtenerPlanActual().then(setActual);
  }, []);

  return (
    <div className="dashboard-page">
      <Sidebar active="planes" />

      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1>Planes y almacenamiento</h1>
            <p className="planes-subtitle">
              Elige el plan que mejor se adapte a tus necesidades
            </p>
          </div>

          <button
            type="button"
            className="upload-button"
            onClick={() => navigate("/planes/historial")}
          >
            <Icon icon="lucide:eye" />
            Historial de pagos
          </button>
        </div>

        <section className="plans-grid" aria-label="Planes disponibles">
          {PLANES.map((plan) => {
            const esActual = actual?.planId === plan.id;

            return (
              <article
                key={plan.id}
                className={`plan-card${esActual ? " current" : ""}`}
              >
                <h2 className="plan-name">{plan.nombre}</h2>

                <div className="plan-features">
                  <strong>{formatPrecio(plan.precio)} / mes</strong>

                  <strong>
                    {plan.almacenamientoGb} GB
                    <br />
                    almacenamiento
                  </strong>

                  <strong>
                    {plan.descargasMensuales === null ? (
                      textoDescargas(plan)
                    ) : (
                      <>
                        {plan.descargasMensuales} descargas
                        <br />
                        mensuales
                      </>
                    )}
                  </strong>
                </div>

                {esActual ? (
                  <button type="button" className="plan-button current" disabled>
                    Plan Actual
                  </button>
                ) : (
                  <button
                    type="button"
                    className="plan-button"
                    onClick={() => navigate(`/planes/contratar?plan=${plan.id}`)}
                  >
                    Contratar Plan
                  </button>
                )}

                {esActual && actual && (
                  <span className="plan-renewal">Renueva el {actual.renovacion}</span>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default Planes;
