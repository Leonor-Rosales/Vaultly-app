import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import toast, { Toaster, resolveValue } from "react-hot-toast";
import Icon from './components/IconoAviso';
import { ProveedorAvisos } from './components/Avisos';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorAvisos><App /></ProveedorAvisos>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }}>
        {t => <div className="aviso-toast" role={t.type === 'error' ? 'alert' : 'status'} style={{ opacity: t.visible ? 1 : 0 }}>
          <Icon icon={t.type === 'success' ? 'lucide:circle-check' : t.type === 'error' ? 'lucide:circle-alert' : 'lucide:info'} />
          <div><strong>{t.type === 'success' ? 'Listo' : t.type === 'error' ? 'No se pudo completar' : 'Aviso'}</strong><p>{resolveValue(t.message, t)}</p></div>
          <button type="button" aria-label="Cerrar notificación" onClick={() => toast.dismiss(t.id)}><Icon icon="lucide:x" /></button>
        </div>}
      </Toaster>
    </BrowserRouter>
  </React.StrictMode>
);
