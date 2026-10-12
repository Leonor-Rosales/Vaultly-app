import { useState } from "react";
import { register, resendVerification, ApiError } from "../services/auth";
import { emailValido, errorPassword, evaluarPassword } from "../services/passwordPolicy";
import PasswordRequirements from "../components/PasswordRequirements";
import { Icon } from "@iconify/react";
import { Link, useNavigate } from "react-router-dom";

import "./Registro.css";
import "../recuperar/Recuperar.css";

function Registro() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Modal de correo existente
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [errorCampos, setErrorCampos] = useState("");
  const [resultado, setResultado] = useState<{ mensaje: string; correo_enviado: boolean } | null>(null);

  const navigate = useNavigate();

  if (resultado) return (
    <div className="rec-page">
      <div className="rec-logo">
        <div className="rec-logo-icon"><Icon icon="lucide:vault" /></div>
        <span>Vaultly</span>
      </div>
      <div className="rec-card rec-card-center">
        <div className="rec-mail-icon"><Icon icon={resultado.correo_enviado ? "lucide:mail-check" : "lucide:mail-warning"} /></div>
        <h1>{resultado.correo_enviado ? "Revisa tu correo" : "Tu cuenta fue creada"}</h1>
        <p className="rec-subtitle" role="status">
          {resultado.correo_enviado ? <>Te enviamos un enlace para activar tu cuenta a <strong>{email.trim()}</strong>.</> : resultado.mensaje}
        </p>
        {resultado.correo_enviado && <p className="rec-subtitle">Abre el enlace del correo para activar tu cuenta. Si no lo encuentras, revisa la carpeta de spam.</p>}
        {errorCampos && <p className="error-message" role="alert">{errorCampos}</p>}
        {!resultado.correo_enviado && <button type="button" className="register-button" disabled={creatingAccount}
          onClick={async () => {
            setCreatingAccount(true);
            setErrorCampos("");
            try {
              const respuesta = await resendVerification(email.trim());
              setResultado({ mensaje: respuesta.mensaje, correo_enviado: true });
            } catch (error) {
              setErrorCampos(error instanceof ApiError ? error.message : "No se pudo reenviar el correo");
            } finally { setCreatingAccount(false); }
          }}>
          {creatingAccount ? "Enviando…" : "Reenviar verificación"}
        </button>}
        <Link to="/login" className="rec-link">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );

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
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (creatingAccount || resultado) return;

            // Campos vacíos
            if (!name.trim() || !email.trim() || !password || !confirmPassword) {
              setErrorCampos("Debes completar todos los campos");
              return;
            }

          setErrorCampos("");

            if (!emailValido(email.trim())) {
              setErrorCampos("Correo no válido");
              return;
            }

            // Validar contraseñas
            const error = errorPassword(password, confirmPassword);
            if (error) {
              setErrorCampos(error);
              return;
            }

            try {
  setCreatingAccount(true);

  const respuesta = await register({
    name,
    email: email.trim(),
    password,
    confirmPassword,
  });
  setResultado(respuesta);
  setPassword("");
  setConfirmPassword("");

} catch (error) {
  console.error(error);

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

  setErrorCampos(
    error instanceof ApiError
      ? error.message
      : "No se pudo crear la cuenta"
  );

} finally {
  setCreatingAccount(false);
}
            
          }}
          
        >

          {errorCampos && (
  <p className="error-message" id="registro-error" role="alert">
    {errorCampos}
  </p>
)}

          {!resultado && <>
<label htmlFor="registro-nombre">Nombre completo</label>

<input
  id="registro-nombre"
  type="text"
  placeholder=""
  value={name}
  onChange={(e) => {
    setName(e.target.value);
    setErrorCampos("");
  }}
/>

          {/* CORREO */}
          <label htmlFor="registro-correo">Correo electrónico</label>

          <div className="input-icon">
            <input
              id="registro-correo"
              type="email"
              disabled={!!resultado}
              value={email}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
            />

            {emailValido(email.trim()) && (
              <Icon icon="lucide:circle-check" />
            )}
          </div>

          {email.length > 0 && !emailValido(email.trim()) && (
            <p className="email-error">
              La dirección del correo electrónico no es válida
            </p>
          )}

          {/* CONTRASEÑA */}
          <label htmlFor="registro-password">Contraseña</label>

          <div className="password-container">

            <input
              id="registro-password"
              autoComplete="new-password"
              aria-describedby="registro-requisitos registro-error"
              aria-invalid={password.length > 0 && !evaluarPassword(password).valida}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="eye-button"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
          <PasswordRequirements password={password} id="registro-requisitos" />

          {/* CONFIRMAR CONTRASEÑA */}
          <label htmlFor="registro-confirmacion" className="confirm-password-label">
            Confirmar contraseña
          </label>

          <div className="password-container">

            <input
              id="registro-confirmacion"
              autoComplete="new-password"
              aria-describedby="registro-confirmacion-error registro-error"
              aria-invalid={confirmPassword.length > 0 && confirmPassword !== password}
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
              aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
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
              <p className="error-message" id="registro-confirmacion-error" role="alert">
                Las contraseñas no coinciden
              </p>
            )}

          {/* BOTÓN */}
          <button
            type="submit"
            className="register-button"
            disabled={creatingAccount || !!resultado}
          >
            {creatingAccount ? "Creando cuenta..." : "Crear cuenta"}
          </button>
          </>}

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
