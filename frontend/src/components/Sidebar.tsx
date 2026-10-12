
import { Icon } from "@iconify/react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Usuario } from "../services/auth";
import { useConsumo } from '../services/consumo';
import "./Sidebar.css";

const ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard", to: "/dashboard" },
  { key: "archivos", label: "Mis Archivos", icon: "lucide:folder", to: "/archivos" },
  { key: "biblioteca", label: "Biblioteca Pública", icon: "lucide:globe", to: "/biblioteca" },
  { key: "planes", label: "Planes y Facturación", icon: "lucide:credit-card", to: "/planes" },
  { key: "configuracion", label: "Configuración", icon: "lucide:settings", to: "/configuracion" },
] as const;

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  let usuario: Usuario | null = null;

  try {
    const guardado = localStorage.getItem("usuario");
    usuario = guardado ? JSON.parse(guardado) : null;
  } catch {
    usuario = null;
  }

  const nombre = usuario?.nombre_completo || "Usuario";

  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  const obtenerSeccion = () => {
    if (location.pathname.startsWith("/planes")) return "planes";
    if (location.pathname.startsWith("/archivos")) return "archivos";
    if (location.pathname.startsWith("/biblioteca")) return "biblioteca";
    if (location.pathname.startsWith("/configuracion")) return "configuracion";
    return "dashboard";
  };

  const active = obtenerSeccion();
  const { consumo } = useConsumo();
  const plan = consumo?.plan.nombre ?? 'Consultando plan…';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Icon icon="lucide:vault" />
        </div>
        <span>Vaultly</span>
      </div>

      <nav className="sidebar-menu">
        {ITEMS.map((item) => (
          <div
            key={item.key}
            className={`menu-item${item.key === active ? " active" : ""}`}
            role="link"
            tabIndex={0}
            onClick={() => navigate(item.to)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(item.to);
              }
            }}
          >
            <Icon icon={item.icon} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar">{iniciales}</div>
        <div className="user-info">
          <strong>{nombre}</strong>
          <span className="user-plan">{plan}</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
