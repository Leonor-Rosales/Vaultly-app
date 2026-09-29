import { useState } from "react";
import { Icon } from "@iconify/react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { requestPasswordReset } from "../services/auth";
import "./Recuperar.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pantalla 1: el usuario ingresa su correo para recibir el enlace.
function Recuperar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const emailInvalid = email.length > 0 && !EMAIL_REGEX.test(email);

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
        <p className="rec-subtitle">
          Ingresa tu correo y te enviaremos un enlace para restablecer tu
          contraseña
        </p>

        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();

            if (!EMAIL_REGEX.test(email)) {
              toast.error("Ingresa un correo electrónico válido");
              return;
            }

            setSending(true);
            try {
              await requestPasswordReset({ email });
              navigate("/recuperar/enviado", { state: { email } });
            } catch {
              toast.error("No pudimos enviar el enlace. Intenta de nuevo.");
            } finally {
              setSending(false);
            }
          }}
        >
          <label htmlFor="rec-email">Correo electrónico</label>
          <input
            id="rec-email"
            type="email"
            placeholder="tu-correo@ejemplo.com"
            autoComplete="email"
            className={emailInvalid ? "rec-input-error" : ""}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailInvalid && (
            <p className="rec-error">
              La dirección del correo electrónico no es válida
            </p>
          )}

          <button type="submit" className="rec-button" disabled={sending}>
            {sending ? "Enviando..." : "Enviar enlace de recuperación"}
          </button>
        </form>

        <Link to="/" className="rec-back">
          <Icon icon="lucide:arrow-left" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default Recuperar;
