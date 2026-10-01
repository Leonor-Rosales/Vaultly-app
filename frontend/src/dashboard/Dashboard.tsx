import { Icon } from "@iconify/react";
import "./Dashboard.css";
import { useNavigate } from "react-router-dom";
function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="dashboard-page">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Icon icon="lucide:vault" />
          </div>
          <span>Vaultly</span>
        </div>

        <nav className="sidebar-menu">

          <div className="menu-item active">
            <Icon icon="lucide:layout-dashboard" />
            <span>Dashboard</span>
          </div>

          <div className="menu-item">
            <Icon icon="lucide:folder" />
            <span>Mis Archivos</span>
          </div>

          <div className="menu-item">
            <Icon icon="lucide:globe" />
            <span>Biblioteca Pública</span>
          </div>

          <div className="menu-item" onClick={() => navigate("/planes")}>
            <Icon icon="lucide:credit-card" />
            <span>Planes y Facturación</span>
          </div>

          <div className="menu-item">
            <Icon icon="lucide:settings" />
            <span>Configuración</span>
          </div>

        </nav>

        {/* USUARIO */}
        <div className="sidebar-user">
          <div className="user-avatar">
            FP
          </div>

          <div className="user-info">
            <strong>Fernando Pérez</strong>
            <span>Pro Developer</span>
          </div>
        </div>

      </aside>


      {/* CONTENIDO PRINCIPAL */}
      <main className="dashboard-content">

        <div className="dashboard-header">
          <h1>Dashboard</h1>

          <button className="upload-button">
            <Icon icon="lucide:upload" />
            Cargar archivo
          </button>
        </div>


        {/* TARJETAS */}
        <section className="stats-grid">

          <div className="stat-card">
            <span className="stat-title">Plan actual</span>

            <strong>Pro Developer</strong>

            <small>
              Renueva el 24 de octubre de 2026
            </small>
          </div>


          <div className="stat-card storage-card">
            <span className="stat-title">Almacenamiento</span>

            <strong>12.4 GB de 20 GB</strong>

            <span className="storage-text">
              usados
            </span>

            <div className="storage-bar">
              <div className="storage-progress"></div>
            </div>
          </div>


          <div className="stat-card">
            <span className="stat-title">Descargas del mes</span>

            <strong className="download-number">
              <Icon icon="lucide:download" />
              7 de 20
            </strong>

            <small>descargas restantes</small>
          </div>


          <div className="stat-card">
            <span className="stat-title">
              Archivos públicos compartidos
            </span>

            <strong>2 recursos</strong>

            <small>
              Visibles en tu biblioteca pública
            </small>
          </div>

        </section>


        {/* ARCHIVOS */}
        <section className="recent-files">

          <h2>Archivos recientes</h2>

          <div className="files-table">

            {/* HEADER */}
            <div className="file-row file-header">
              <span>Nombre del archivo</span>
              <span>Fecha de carga</span>
              <span>Visibilidad</span>
            </div>


            {/* ARCHIVO 1 */}
            <div className="file-row">

              <div className="file-name">
                <div className="file-icon">
                  <Icon icon="lucide:file-text" />
                </div>

                <span>
                  Especificaciones_Proyecto_Final.pdf
                </span>
              </div>

              <span>Hace 2 horas</span>

              <span className="visibility private">
                Privado
              </span>

            </div>


            {/* ARCHIVO 2 */}
            <div className="file-row">

              <div className="file-name">
                <div className="file-icon">
                  <Icon icon="lucide:image" />
                </div>

                <span>
                  Captura_Pantalla_Dashboard_V2.png
                </span>
              </div>

              <span>Ayer, 18:45</span>

              <span className="visibility public">
                Público
              </span>

            </div>


            {/* ARCHIVO 3 */}
            <div className="file-row">

              <div className="file-name">
                <div className="file-icon">
                  <Icon icon="lucide:archive" />
                </div>

                <span>
                  Assets_Iconos_Vaultly.zip
                </span>
              </div>

              <span>15 Oct 2025</span>

              <span className="visibility private">
                Privado
              </span>

            </div>


            {/* ARCHIVO 4 */}
            <div className="file-row">

              <div className="file-name">
                <div className="file-icon">
                  <Icon icon="lucide:code-2" />
                </div>

                <span>
                  index.config.ts
                </span>
              </div>

              <span>12 Oct 2025</span>

              <span className="visibility public">
                Público
              </span>

            </div>


            {/* ARCHIVO 5 */}
            <div className="file-row">

              <div className="file-name">
                <div className="file-icon">
                  <Icon icon="lucide:file" />
                </div>

                <span>
                  Base_Datos_Clientes_2025.csv
                </span>
              </div>

              <span>08 Oct 2025</span>

              <span className="visibility private">
                Privado
              </span>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default Dashboard;