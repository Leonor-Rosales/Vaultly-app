import { useEffect, useState } from "react";
import { login, ApiError } from "../services/auth";
import { Icon } from "@iconify/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";

function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [errorCredenciales, setErrorCredenciales] = useState("");
  

  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get("verificado") === "1") {
      searchParams.delete("verificado");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="login-page">

      {/* LOGO */}
      <div className="logo">
        <div className="logo-icon">
          <Icon icon="lucide:vault" 
          />
        </div>
        <span>Vaultly</span>
      </div>

      {/* LOGIN */}
      <div className="login-card">
        <h1>Iniciar sesión</h1>

        <p className="subtitle">
          Ingresa a tu cuenta de Vaultly
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();

            try {
              await login({
                email,
                password,
              });

              navigate("/dashboard");

            } catch (error) {
  console.error(error);

  if (
    error instanceof ApiError &&
    error.code === "USUARIO_NO_REGISTRADO"
  ) {
    setMostrarRegistro(true);
    return;
  }

  if (
    error instanceof ApiError &&
    error.code === "CORREO_NO_CONFIRMADO"
  ) {
    setErrorCredenciales(
      "Debes confirmar tu correo antes de iniciar sesión"
    );
    return;
  }

  setErrorCredenciales("Correo o contraseña incorrectos");
}
          }}
        >
          <label>Correo electrónico</label>

          <input
            type="text"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {email.length > 0 && !email.endsWith("@gmail.com") && (
            <p className="email-error">
              La dirección del correo electrónico no es válida
            </p>
          )}

          <label>Contraseña</label>

          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="eye-button"
              onClick={() => setShowPassword(!showPassword)}
            >
              <Icon
                icon={
                  showPassword
                    ? "lucide:eye"
                    : "lucide:eye-off"
                }
              />
            </button>
          </div>
          {errorCredenciales && (
  <p className="login-error">
    {errorCredenciales}
  </p>
)}

          <div className="forgot">
            <Link to="/recuperar">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            className="login-button"
          >
            Iniciar sesión
          </button>

          <div className="divider">
            <span></span>
            <p>o</p>
            <span></span>
          </div>

          <p className="register">
            ¿No tienes cuenta?{" "}
            <Link to="/registro">
              Regístrate
            </Link>
          </p>
        </form>
      </div>

      {/* MODAL USUARIO NO REGISTRADO */}
      {mostrarRegistro && (
        <div className="modal-overlay">
          <div className="registro-modal">

            <div className="modal-icon">
              <Icon icon="lucide:check" />
            </div>

            <h2>Regístrate</h2>

            <p>
              Debes registrarte para poder iniciar sesión
            </p>

            <button
              className="modal-register-button"
              onClick={() => navigate("/registro")}
            >
              Ir a registro
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;