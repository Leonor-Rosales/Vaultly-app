import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./cuenta/Propuesta.css";
import "./admin/PropuestaAdmin.css";
import "./components/Acceso.css";
import AvisosPublicos from './components/AvisosPublicos';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <AvisosPublicos />
    </BrowserRouter>
  </React.StrictMode>
);
