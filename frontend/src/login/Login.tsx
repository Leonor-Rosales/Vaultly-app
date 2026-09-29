import { useEffect, useState } from "react";
import { login } from "../services/auth";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import "./Login.css";
function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

   useEffect(() => {
    if (searchParams.get("verificado") === "1") {
      

      searchParams.delete("verificado");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="login-page">
      <div className="logo">
        <div className="logo-icon">
        <Icon icon="lucide:vault"/>
        </div>
        <span>Vaultly</span>
      </div>

      <div className="login-card">
        <h1>Iniciar sesión</h1>
        <p className="subtitle">Ingresa a tu cuenta de Vaultly</p>

        <form
  onSubmit={async (e) => {
  e.preventDefault();

  try {
    await login({
      email,
      password,
    });

    alert("¡Ya entraste! 🎉");
  } catch (error) {
    console.error(error);
    alert("Correo o contraseña incorrectos");
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
  <Icon icon={showPassword ? "lucide:eye" : "lucide:eye-off"} />
</button>
          </div>

          <div className="forgot">
  <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
</div>

          <button type="submit" className="login-button">
            Iniciar sesión
          </button>

          <div className="divider">
            <span></span>
            <p>o</p>
            <span></span>
          </div>

          <p className="register">
  ¿No tienes cuenta?{" "}
  <Link to="/registro">Regístrate</Link>
</p>
        </form>
      </div>
    </div>
  );
}

export default App;