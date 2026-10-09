import { useState } from "react";
import { Icon } from "@iconify/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { resetPassword } from "../services/auth";
import "./Recuperar.css";



// Devuelve 0 (vacía) a 3 (fuerte).
function passwordScore(password: string): number {
  if (password.length === 0) return 0;

  if (password.length < 5) {
    return 1;
  } else if (password.length <= 8) {
    return 2;
  } else {
    return 3;
  }
}

const STRENGTH_LABELS = ["", "Baja", "Media", "Alta"];

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

  const score = passwordScore(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length > 0 && password === confirm && !saving;

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
              if (!canSubmit) return;

              setSaving(true);
              try {
                await resetPassword({ token, password });
                toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
                navigate("/");
              } catch {
                toast.error("No pudimos actualizar la contraseña. Intenta de nuevo.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <label htmlFor="rec-password">Nueva contraseña</label>
            <div className="rec-password">
              <input
                id="rec-password"
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

            <div className="rec-strength">
              <div className="rec-strength-bars">
                {[1, 2, 3].map((level) => (
                  <span key={level} className={score >= level ? "rec-on" : ""} />
                ))}
              </div>
              {score > 0 && (
                <p>
                  Fuerza: <strong>{STRENGTH_LABELS[score]}</strong>
                </p>
              )}
              
            </div>

            <label htmlFor="rec-confirm">Confirmar contraseña</label>
            <div className="rec-password rec-field-gap">
              <input
                id="rec-confirm"
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
              <p className="rec-error" style={{ margin: "-10px 0 14px" }}>
                Las contraseñas no coinciden
              </p>
            )}

            <button type="submit" className="rec-button" disabled={!canSubmit}>
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