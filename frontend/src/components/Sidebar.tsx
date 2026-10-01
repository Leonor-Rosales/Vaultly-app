import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";

// Barra lateral compartida. Usa las clases de dashboard/Dashboard.css
// (.sidebar, .menu-item, etc.), así que quien la use debe importar ese CSS.

export type SidebarSection =
  | "dashboard"
  | "archivos"
  | "biblioteca"
  | "planes"
  | "configuracion";

interface SidebarItem {
  key: SidebarSection;
  label: string;
  icon: string;
  // Ruta a la que navega. Si no existe todavía, queda sin definir.
  to?: string;
}

const ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard", to: "/dashboard" },
  { key: "archivos", label: "Mis Archivos", icon: "lucide:folder" },
  { key: "biblioteca", label: "Biblioteca Pública", icon: "lucide:globe" },
  { key: "planes", label: "Planes y Facturación", icon: "lucide:credit-card", to: "/planes" },
  { key: "configuracion", label: "Configuración", icon: "lucide:settings" },
];

interface SidebarProps {
  active: SidebarSection;
}

function Sidebar({ active }: SidebarProps) {
  const navigate = useNavigate();

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
            onClick={() => item.to && navigate(item.to)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && item.to) navigate(item.to);
            }}
          >
            <Icon icon={item.icon} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Datos fijos igual que en Dashboard.tsx, hasta tener sesión real */}
      <div className="sidebar-user">
        <div className="user-avatar">FP</div>
        <div className="user-info">
          <strong>Fernando Pérez</strong>
          <span>Pro Developer</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
