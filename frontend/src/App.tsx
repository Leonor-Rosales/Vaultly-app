import { Routes, Route } from "react-router-dom";
import Login from "./login/Login";
import Registro from "./registro/Registro";
import Recuperar from "./recuperar/Recuperar";
import AvisoRecuperar from "./recuperar/AvisoRecuperar";
import NuevaPassword from "./recuperar/NuevaPassword";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/recuperar/enviado" element={<AvisoRecuperar />} />
      <Route path="/restablecer" element={<NuevaPassword />} />
    </Routes>
  );
}

export default App;