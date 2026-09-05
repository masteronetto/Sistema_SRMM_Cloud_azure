import { NavLink, Outlet } from 'react-router-dom';
import AzureSession from './AzureSession';

export default function AppLayout({ azureConfigured }) {
  const linkClass = ({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="SRMM inicio">
          <span className="brand-mark">S</span>
          <span>SRMM <small>cloud base</small></span>
        </NavLink>
        {azureConfigured && <AzureSession />}
      </header>
      {azureConfigured && (
        <nav className="main-nav" aria-label="Navegación principal">
          <NavLink className={linkClass} to="/">Inicio</NavLink>
          <NavLink className={linkClass} to="/maquinaria">Maquinaria</NavLink>
          <NavLink className={linkClass} to="/reportes">Reportes</NavLink>
          <NavLink className={linkClass} to="/historial">Historial</NavLink>
        </nav>
      )}
      <Outlet />
    </main>
  );
}
