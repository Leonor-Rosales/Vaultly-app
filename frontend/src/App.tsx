import { Routes, Route } from "react-router-dom";
import Login from "./login/Login";
import Registro from "./registro/Registro";

import Recuperar from "./recuperar/Recuperar";
import AvisoRecuperar from "./recuperar/AvisoRecuperar";
import NuevaPassword from "./recuperar/NuevaPassword";
import Dashboard from "./dashboard/Dashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route path="/recuperar" element={<Recuperar />} />

      <Route
        path="/recuperar/confirmacion"
        element={<AvisoRecuperar />}
      />

      <Route
        path="/recuperar/enviado"
        element={<AvisoRecuperar />}
      />

      {/* Enlace que llega desde el correo */}
      <Route
        path="/restablecer"
        element={<NuevaPassword />}
      />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;