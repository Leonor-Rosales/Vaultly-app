import { useState } from "react";
import { Icon } from "@iconify/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { resetPassword, ApiError } from "../services/auth";
import { errorPassword, evaluarPassword } from "../services/passwordPolicy";
import PasswordRequirements from "../components/PasswordRequirements";
import "./Recuperar.css";



// Pantalla 3: el usuario llega desde el enlace del correo (/restablecer?token=...)
// y define su nueva contraseña.
function NuevaPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="rec-page">
      <div className="rec-logo">
        <div className="rec-logo-icon">
          <Icon icon="lucide:vault" />
        </div>
        <span>Vaultly</span>
      </div>

      <div className="rec-card">
        <h1>Recuperar contraseña</h1>

        {!token ? (
          <>
            <p className="rec-subtitle">
              El enlace de recuperación no es válido o ya venció. Solicita uno
              nuevo.
            </p>
            <Link to="/recuperar" className="rec-link">
              Solicitar un nuevo enlace
            </Link>
          </>
        ) : (
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              const problema = errorPassword(password, confirm);
              setError(problema);
              if (problema) return;

              setSaving(true);
              try {
                await resetPassword({ token, password });
                toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
                navigate("/");
              } catch (error) {
                setError(error instanceof ApiError ? error.message : "No pudimos actualizar la contraseña. Intenta de nuevo.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {error && <p className="rec-error" id="rec-error" role="alert">{error}</p>}
            <label htmlFor="rec-password">Nueva contraseña</label>
            <div className="rec-password">
              <input
                id="rec-password"
                aria-describedby="rec-requisitos rec-error"
                aria-invalid={password.length > 0 && !evaluarPassword(password).valida}
                type={showPassword ? "text" : "password"}
                placeholder="Nueva contraseña"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="rec-eye"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowPassword(!showPassword)}
              >
                <Icon icon={showPassword ? "lucide:eye" : "lucide:eye-off"} />
              </button>
            </div>

            <PasswordRequirements password={password} id="rec-requisitos" />

            <label htmlFor="rec-confirm">Confirmar contraseña</label>
            <div className="rec-password rec-field-gap">
              <input
                id="rec-confirm"
                aria-describedby="rec-confirm-error rec-error"
                aria-invalid={mismatch}
                type={showConfirm ? "text" : "password"}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className={mismatch ? "rec-input-error" : ""}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                className="rec-eye"
                aria-label={
                  showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowConfirm(!showConfirm)}
              >
                <Icon icon={showConfirm ? "lucide:eye" : "lucide:eye-off"} />
              </button>
            </div>
            {mismatch && (
              <p className="rec-error" id="rec-confirm-error" role="alert" style={{ margin: "-10px 0 14px" }}>
                Las contraseñas no coinciden
              </p>
            )}

            <button type="submit" className="rec-button" disabled={saving}>
              {saving ? "Guardando..." : "Reestablecer contraseña"}
            </button>
          </form>
        )}

        <Link to="/" className="rec-back">
          <Icon icon="lucide:arrow-left" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default NuevaPassword;
