import { NavLink, Outlet } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import AzureSession from './AzureSession';

function SessionProfile() {
  const { accounts } = useMsal();
  const account = accounts[0];
  const role = account?.idTokenClaims?.roles?.[0] || account?.idTokenClaims?.rol_acceso || 'Usuario';

  return (
    <>
      <div className="user-avatar">{(account?.name || 'U').slice(0, 2).toUpperCase()}</div>
      <div className="user-copy"><strong>{account?.name || 'Usuario'}</strong><span>{account?.username || 'Cuenta Microsoft'}</span><em>{role}</em></div>
    </>
  );
}

export default function AppLayout({ azureConfigured }) {
  const linkClass = ({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="SRMM inicio">
          <span className="brand-mark">SR</span>
          <span>SRMM <small>Hermosilla y García Ltda.</small></span>
        </NavLink>
        <div className="sidebar-section-title">Dashboard</div>
        <nav className="main-nav" aria-label="Navegación principal">
          <NavLink className={linkClass} to="/"><span className="nav-icon">⌂</span>Inicio</NavLink>
          <NavLink className={linkClass} to="/maquinaria"><span className="nav-icon">✣</span>Maquinaria</NavLink>
          <NavLink className={linkClass} to="/historial"><span className="nav-icon">◉</span>Mantenimiento</NavLink>
          <NavLink className={linkClass} to="/reportes"><span className="nav-icon">▤</span>Reportes</NavLink>
          <span className="nav-link nav-disabled"><span className="nav-icon">↻</span>Arriendo</span>
          <span className="nav-link nav-disabled"><span className="nav-icon">➜</span>Logística</span>
          <span className="nav-link nav-disabled"><span className="nav-icon">●</span>Usuarios</span>
        </nav>
        <div className="sidebar-user">
          {azureConfigured ? <SessionProfile /> : <><div className="user-avatar">AI</div><div className="user-copy"><strong>Admin Inicial</strong><span>admin@srmm.cl</span><em>Vista previa</em></div></>}
          {azureConfigured && <AzureSession />}
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <h1 className="page-title">Inicio</h1>
          <div className="topbar-tools">
            <div className="period-buttons"><button>Últ. semana</button><button>Últ. mes</button><button>Últ. 3m</button><button>Personalizado</button></div>
            <label className="date-control">07-08-2026 <input type="date" defaultValue="2026-08-07" /></label>
            <label className="date-control">05-09-2026 <input type="date" defaultValue="2026-09-05" /></label>
            <span className="range-pill">Rango: 06-ago — 04-sept</span>
            <button className="alert-button">△ Alertas</button>
          </div>
        </header>
        <Outlet />
      </section>
    </main>
  );
}
