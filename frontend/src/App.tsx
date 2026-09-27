import { Routes, Route } from "react-router-dom";
import Login from "./login/Login";
import Registro from "./registro/Registro";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
    </Routes>
  );
}

export default App;