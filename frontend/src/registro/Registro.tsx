import { useState } from "react";
import { register, ApiError } from "../services/auth";
import { Icon } from "@iconify/react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import "./Registro.css";

function Registro() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Modal de correo existente
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [errorCampos, setErrorCampos] = useState("");

  const navigate = useNavigate();

  let passwordStrength = "";
  let strengthBars = 0;

  if (password.length >= 1 && password.length < 5) {
    passwordStrength = "Baja";
    strengthBars = 1;
  } else if (password.length >= 5 && password.length <= 8) {
    passwordStrength = "Media";
    strengthBars = 2;
  } else if (password.length > 8) {
    passwordStrength = "Alta";
    strengthBars = 3;
  }

  return (
    <div className="registro-page">

      {/* LOGO */}
      <div className="logo">
        <div className="logo-icon">
          <Icon icon="lucide:vault" />
        </div>
        <span>Vaultly</span>
      </div>

      {/* MODAL CORREO YA REGISTRADO */}
      {mostrarLogin && (
        <div className="modal-overlay">
          <div className="registro-modal">

            <div className="modal-icon">
              <Icon icon="lucide:check" />
            </div>

            <h2>Correo ya registrado</h2>

            <p>
              Este correo ya tiene una cuenta en Vaultly.
            </p>

            <button
              className="modal-register-button"
              onClick={() => navigate("/login")}
            >
              Iniciar sesión
            </button>

          </div>
        </div>
      )}

      {/* TARJETA */}
      <div className="registro-card">

        <h1>Crear cuenta</h1>

        <p className="subtitle">
          Únete a Vaultly y empieza a compartir
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();

            // Campos vacíos
            if (!name.trim() || !email.trim() || !password || !confirmPassword) {
  setErrorCampos("Debes completar todos los campos");
  return;
}

setErrorCampos("");

            // Validar correo Gmail
            if (!/^[^\s@]+@gmail\.com$/.test(email)) {
              return; 
            }

            // Validar contraseñas
            if (password !== confirmPassword) {
              return;
            }

            try {
              await register({
                name,
                email,
                password,
              });

              toast.success("Cuenta creada correctamente");

              setTimeout(() => {
                navigate("/");
              }, 1500);

            } catch (error) {
              console.error(error);

              // CORREO YA REGISTRADO
              if (
                  error instanceof ApiError &&
                  (
                    error.code === "CORREO_YA_REGISTRADO" ||
                    error.status === 409
                  )
                ) {
                  setMostrarLogin(true);
                  return;
                }

              // Otro error
              toast.error(
                error instanceof ApiError
                  ? error.message
                  : "No se pudo crear la cuenta"
              );
            }
          }}
        >

          {errorCampos && (
  <p className="error-message">
    {errorCampos}
  </p>
)}

<label>Nombre completo</label>

<input
  type="text"
  placeholder=""
  value={name}
  onChange={(e) => {
    setName(e.target.value);
    setErrorCampos("");
  }}
/>

          {/* CORREO */}
          <label>Correo electrónico</label>

          <div className="input-icon">
            <input
              type="text"
              value={email}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
            />

            {email.endsWith("@gmail.com") && (
              <Icon icon="lucide:circle-check" />
            )}
          </div>

          {email.length > 0 && !email.endsWith("@gmail.com") && (
            <p className="email-error">
              La dirección del correo electrónico no es válida
            </p>
          )}

          {/* CONTRASEÑA */}
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

          {/* FUERZA */}
          {password.length > 0 && (
            <>
              <div className="password-strength">
                <span className={strengthBars >= 1 ? "active" : ""}></span>
                <span className={strengthBars >= 2 ? "active" : ""}></span>
                <span className={strengthBars >= 3 ? "active" : ""}></span>
              </div>

              <p
                className={`strength-text ${passwordStrength.toLowerCase()}`}
              >
                Fuerza: <strong>{passwordStrength}</strong>
              </p>
            </>
          )}

          {/* CONFIRMAR CONTRASEÑA */}
          <label className="confirm-password-label">
            Confirmar contraseña
          </label>

          <div className="password-container">

            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button
              type="button"
              className="eye-button"
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            >
              <Icon
                icon={
                  showConfirmPassword
                    ? "lucide:eye"
                    : "lucide:eye-off"
                }
              />
            </button>

          </div>

          {confirmPassword.length > 0 &&
            confirmPassword !== password && (
              <p className="error-message">
                Las contraseñas no coinciden
              </p>
            )}

          {/* BOTÓN */}
          <button
            type="submit"
            className="register-button"
          >
            Crear cuenta
          </button>

          <div className="registrer-divider">
            <span></span>
            <p>o</p>
            <span></span>
          </div>

          {/* LOGIN */}
          <p className="register">
            ¿Ya tienes cuenta?{" "}
            <Link to="/" className="login-link">
              Inicia sesión
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}

export default Registro;