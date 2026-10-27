import { Routes, Route } from "react-router-dom";
import Login from "./login/Login";
import Registro from "./registro/Registro";

import Recuperar from "./recuperar/Recuperar";
import AvisoRecuperar from "./recuperar/AvisoRecuperar";
import NuevaPassword from "./recuperar/NuevaPassword";
import Dashboard from "./dashboard/Dashboard";
import Planes from "./planes/Planes";
import Contratar from "./planes/Contratar";
import Historial from "./planes/Historial";
import Archivos from "./Archivos/Archivos";
import Biblioteca from "./biblioteca/Biblioteca";
import RutaProtegida from "./components/RutaProtegida";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/recuperar/confirmacion" element={<AvisoRecuperar />} />
      <Route path="/recuperar/enviado" element={<AvisoRecuperar />} />
      <Route path="/restablecer" element={<NuevaPassword />} />

      <Route element={<RutaProtegida />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/archivos" element={<Archivos />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/planes" element={<Planes />} />
        <Route path="/planes/contratar" element={<Contratar />} />
        <Route path="/planes/historial" element={<Historial />} />
      </Route>
    </Routes>
  );
}

export default App;
