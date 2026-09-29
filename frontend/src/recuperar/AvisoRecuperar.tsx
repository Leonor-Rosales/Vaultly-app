import { Icon } from "@iconify/react";
import { Link, useLocation } from "react-router-dom";
import "./Recuperar.css";

// Pantalla 2: aviso "Revisa tu correo". Recibe el correo por el estado de
// navegación (lo manda Recuperar.tsx). Si no llega, muestra un texto genérico.
function AvisoRecuperar() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  return (
    <div className="rec-page">
      <div className="rec-logo">
        <div className="rec-logo-icon">
          <Icon icon="lucide:vault" />
        </div>
        <span>Vaultly</span>
      </div>

      <div className="rec-card rec-card-center">
        <div className="rec-mail-icon">
          <Icon icon="lucide:mail-check" />
        </div>

        <h1>Revisa tu correo</h1>
        <p className="rec-subtitle">
          {email ? (
            <>
              Te enviamos un enlace para restablecer tu contraseña a{" "}
              <strong>{email}</strong>
            </>
          ) : (
            "Te enviamos un enlace para restablecer tu contraseña a la dirección registrada."
          )}
        </p>

        <Link to="/" className="rec-link">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default AvisoRecuperar;
