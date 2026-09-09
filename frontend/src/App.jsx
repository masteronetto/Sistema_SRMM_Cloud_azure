import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AzureGate from './components/AzureGate';
import HistorialMantenciones from './components/HistorialMantenciones';
import MaquinariaDashboard from './components/MaquinariaDashboard';
import ReportesDashboard from './components/ReportesDashboard';
import HomePage from './pages/HomePage';
import { useIdentity } from './auth/IdentityContext';

function TenantUnavailable() {
  return (
    <section className="access-placeholder">
      <p className="eyebrow">Módulo preparado</p>
      <h1>Este módulo espera la configuración de Azure.</h1>
      <p>La navegación y la interfaz ya están listas. La consulta de datos se habilitará al conectar Microsoft Entra ID.</p>
    </section>
  );
}

function NoRoleAssigned() {
  const { account } = useIdentity();
  return <section className="access-placeholder"><p className="eyebrow">Acceso pendiente</p><h1>No tienes un rol asignado.</h1><p>{account?.username || 'Tu cuenta Microsoft'} está autenticada, pero un administrador debe asignarte un App Role en SRMM BFF API.</p></section>;
}

function ProtectedView({ children }) {
  const { profile, loading } = useIdentity();
  if (loading) return <section className="access-placeholder"><p className="eyebrow">Validando permisos</p><h1>Cargando tu perfil...</h1></section>;
  if (!profile?.roles?.length) return <NoRoleAssigned />;
  return <AzureGate>{children}</AzureGate>;
}

export default function App({ azureConfigured }) {
  const protectedView = (element) => azureConfigured ? <ProtectedView>{element}</ProtectedView> : <TenantUnavailable />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout azureConfigured={azureConfigured} />}>
          <Route index element={<HomePage azureConfigured={azureConfigured} />} />
          <Route path="maquinaria" element={protectedView(<MaquinariaDashboard />)} />
          <Route path="historial" element={protectedView(<HistorialMantenciones />)} />
          <Route path="reportes" element={protectedView(<ReportesDashboard />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
