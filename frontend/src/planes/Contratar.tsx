import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@iconify/react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAvisos } from '../components/contextoAvisos';
import { contratarPlan, type MetodoPago } from "../services/pagos";
import { formatPrecio, textoDescargas, type Plan } from "./planesData";
import "./Contratar.css";
import { obtenerCatalogo } from "../services/consumo";

const soloDigitos = (valor: string): string => valor.replace(/\D/g, "");

// 1234567890123456 -> "1234 5678 9012 3456"
const formatearTarjeta = (valor: string): string =>
  soloDigitos(valor).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

// 1228 -> "12 / 28"
const formatearVencimiento = (valor: string): string => {
  const digitos = soloDigitos(valor).slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)} / ${digitos.slice(2)}` : digitos;
};

const vencimientoValido = (valor: string): boolean => {
  const digitos = soloDigitos(valor);
  if (digitos.length !== 4) return false;

  const mes = Number(digitos.slice(0, 2));
  const anio = Number(digitos.slice(2));
  if (mes < 1 || mes > 12) return false;

  const hoy = new Date();
  const anioActual = hoy.getFullYear() % 100;
  const mesActual = hoy.getMonth() + 1;
  return anio > anioActual || (anio === anioActual && mes >= mesActual);
};

// Único método disponible: pago simulado con tarjeta.
const METODO: MetodoPago = "tarjeta";

// Pantalla de contratación SIMULADA: no se cobra nada ni se guardan datos de tarjeta.
function Contratar() {
  const { avisarError } = useAvisos();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const plan = planes?.find(p => p.id === searchParams.get("plan"));
  useEffect(() => { obtenerCatalogo().then(setPlanes).catch(e => { avisarError(e, 'No se pudieron cargar los planes'); setPlanes([]); }); }, [avisarError]);

  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Tarjeta
  const [numero, setNumero] = useState("");
  const [mostrarNumero, setMostrarNumero] = useState(true);
  const [titularTarjeta, setTitularTarjeta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");

  // Sin un plan válido en la URL no hay nada que contratar.
  if (planes === null) return <p>Cargando plan…</p>;
  if (!plan) return <Navigate to="/planes" replace />;

  const errores = {
    numero: soloDigitos(numero).length !== 16,
    titularTarjeta: titularTarjeta.trim().length < 3,
    vencimiento: !vencimientoValido(vencimiento),
    cvv: soloDigitos(cvv).length < 3,
  };

  const formularioValido =
    !errores.numero && !errores.titularTarjeta && !errores.vencimiento && !errores.cvv;

  const mostrar = (hayError: boolean): boolean => intentado && hayError;

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    if (!formularioValido) return;

    setEnviando(true);
    try {
      // Solo se envían el plan y el método, nunca los datos de la tarjeta.
      await contratarPlan({ planId: plan.id, metodo: METODO });
      toast.success(`Plan ${plan.nombre} contratado`);
      navigate("/planes/historial");
    } catch (error) {
      avisarError(error, 'No se pudo contratar el plan');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ct-page">
      <div className="ct-logo">
        <div className="ct-logo-icon">
          <Icon icon="lucide:vault" />
        </div>
        <span>Vaultly</span>
      </div>

      <form className="ct-card" onSubmit={confirmar} noValidate>
        <h1>Confirmar contratación</h1>

        <div className="ct-summary">
          <div>
            <span className="ct-label">Plan seleccionado</span>
            <div className="ct-box">
              <div className="ct-box-title">{plan.nombre}</div>
              <div className="ct-box-detail">{formatPrecio(plan.precio)} / mes</div>
              <div className="ct-box-detail">{plan.almacenamientoGb} GB Almacenamiento</div>
              <div className="ct-box-detail">
                {plan.descargasMensuales === null
                  ? "Descargas ilimitadas"
                  : textoDescargas(plan)}
              </div>
            </div>
          </div>

          <div>
            <span className="ct-label">Método de pago</span>
            <div className="ct-box">
              <label className="ct-radio">
                <input type="radio" name="metodo" checked onChange={() => undefined} />
                Tarjeta simulada
              </label>
              <div className="ct-total">
                Total a pagar {formatPrecio(plan.precio).replace("Q", "Q ")}
              </div>
            </div>
          </div>
        </div>

        <div className="ct-field">
          <label htmlFor="ct-numero">Número de tarjeta</label>
          <div className="ct-number">
            <input
              id="ct-numero"
              className={`ct-input${mostrar(errores.numero) ? " invalid" : ""}`}
              type={mostrarNumero ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000 0000 0000 0000"
              value={numero}
              onChange={(e) => setNumero(formatearTarjeta(e.target.value))}
            />
            <div className="ct-number-extras">
              <button
                type="button"
                className="ct-eye"
                aria-label={mostrarNumero ? "Ocultar número" : "Mostrar número"}
                onClick={() => setMostrarNumero(!mostrarNumero)}
              >
                <Icon icon={mostrarNumero ? "lucide:eye" : "lucide:eye-off"} />
              </button>
              <span className="ct-badge">VISA</span>
              <span className="ct-badge">MC</span>
              <span className="ct-badge">AMEX</span>
            </div>
          </div>
          {mostrar(errores.numero) && (
            <p className="ct-error">Ingresa los 16 dígitos de la tarjeta</p>
          )}
        </div>

        <div className="ct-field">
          <label htmlFor="ct-titular-tarjeta">Nombre de titular</label>
          <input
            id="ct-titular-tarjeta"
            className={`ct-input${mostrar(errores.titularTarjeta) ? " invalid" : ""}`}
            type="text"
            autoComplete="off"
            placeholder="Fernando Pérez"
            value={titularTarjeta}
            onChange={(e) => setTitularTarjeta(e.target.value)}
          />
          {mostrar(errores.titularTarjeta) && (
            <p className="ct-error">Ingresa el nombre del titular</p>
          )}
        </div>

        <div className="ct-row">
          <div className="ct-field">
            <label htmlFor="ct-vencimiento">Fecha de vencimiento</label>
            <input
              id="ct-vencimiento"
              className={`ct-input${mostrar(errores.vencimiento) ? " invalid" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM / AA"
              value={vencimiento}
              onChange={(e) => setVencimiento(formatearVencimiento(e.target.value))}
            />
            {mostrar(errores.vencimiento) && (
              <p className="ct-error">Fecha no válida o vencida</p>
            )}
          </div>

          <div className="ct-field">
            <label htmlFor="ct-cvv">CVV</label>
            <input
              id="ct-cvv"
              className={`ct-input${mostrar(errores.cvv) ? " invalid" : ""}`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(soloDigitos(e.target.value))}
            />
            {mostrar(errores.cvv) && <p className="ct-error">3 o 4 dígitos</p>}
          </div>
        </div>

        <div className="ct-actions">
          <button type="submit" className="ct-primary" disabled={enviando}>
            {enviando ? "Procesando..." : "Confirmar Pago"}
          </button>
          <button
            type="button"
            className="ct-secondary"
            onClick={() => navigate("/planes")}
          >
            Cancelar
          </button>
        </div>

        <p className="ct-note">
          Pago simulado. No se realizará ningún cobro real ni se guardan los datos de la tarjeta.
        </p>
      </form>
    </div>
  );
}

export default Contratar;
