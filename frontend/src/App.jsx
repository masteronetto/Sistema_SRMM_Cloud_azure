import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AzureGate from './components/AzureGate';
import HistorialMantenciones from './components/HistorialMantenciones';
import MaquinariaDashboard from './components/MaquinariaDashboard';
import ReportesDashboard from './components/ReportesDashboard';
import HomePage from './pages/HomePage';

function TenantUnavailable() {
  return (
    <section className="access-placeholder">
      <p className="eyebrow">Módulo preparado</p>
      <h1>Este módulo espera la configuración de Azure.</h1>
      <p>La navegación y la interfaz ya están listas. La consulta de datos se habilitará al conectar Microsoft Entra ID.</p>
    </section>
  );
}

export default function App({ azureConfigured }) {
  const protectedView = (element) => azureConfigured ? <AzureGate>{element}</AzureGate> : <TenantUnavailable />;

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
