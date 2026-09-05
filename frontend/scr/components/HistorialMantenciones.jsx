import React, { useState, useEffect } from 'react';

export default function HistorialMantenciones({ maquinaId = null }) {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [order, setOrder] = useState('desc');
    const [loading, setLoading] = useState(false);
    const [reporting, setReporting] = useState(false);

    const [fechaFrom, setFechaFrom] = useState('');
    const [fechaTo, setFechaTo] = useState('');
    const [tipoServicio, setTipoServicio] = useState('');
    const [serviceTypes, setServiceTypes] = useState([]);
    const [currentRole, setCurrentRole] = useState('');

    useEffect(() => {
        try {
            const token = localStorage.getItem('srmm_token') || '';
            const payload = token.split('.')[1];
            if (payload) {
                const user = JSON.parse(atob(payload));
                setCurrentRole(user.rol_acceso || '');
            }
        } catch (error) {
            console.error('Error leyendo rol de usuario', error);
        }
    }, []);

    useEffect(() => {
        const fetchServiceTypes = async () => {
            try {
                const token = localStorage.getItem('srmm_token') || '';
                const headers = { 'Authorization': `Bearer ${token}` };
                const res = await fetch('/api/mantenimientos/tipos-servicio', { headers });
                if (!res.ok) return;
                const payload = await res.json();
                setServiceTypes(Array.isArray(payload.data) ? payload.data : []);
            } catch (error) {
                console.error('Error cargando tipos de servicio', error);
            }
        };

        fetchServiceTypes();
    }, []);

    useEffect(() => {
        fetchPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, perPage, order, maquinaId, fechaFrom, fechaTo, tipoServicio]);

    const canGenerateReport = ['Administrador', 'Mecanico', 'Operador'].includes(currentRole);

    const loadJsPdf = () => {
        if (window.jspdf?.jsPDF) {
            return Promise.resolve(window.jspdf.jsPDF);
        }

        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-srmm-jspdf="true"]');
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(window.jspdf.jsPDF), { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
            script.async = true;
            script.dataset.srmmJspdf = 'true';
            script.onload = () => resolve(window.jspdf.jsPDF);
            script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
            document.head.appendChild(script);
        });
    };

    const fetchPage = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('srmm_token') || '';
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

            if (!maquinaId) {
                setRows([]);
                setTotal(0);
                setLoading(false);
                return;
            }

            const params = new URLSearchParams({
                page,
                per_page: perPage,
                order,
            });

            if (fechaFrom) params.append('fecha_inicio', fechaFrom);
            if (fechaTo) params.append('fecha_fin', fechaTo);
            if (tipoServicio) params.append('tipo_servicio', tipoServicio);

            const url = `/api/mantenimientos/maquina/${maquinaId}/historial?${params.toString()}`;
            const res = await fetch(url, { headers });
            if (!res.ok) {
                console.error('Error cargando historial', res.status);
                setRows([]);
                setTotal(0);
                setLoading(false);
                return;
            }
            const payload = await res.json();
            setRows(Array.isArray(payload.data) ? payload.data : []);
            setTotal(payload.total || payload.cantidad || 0);
        } catch (error) {
            console.error('Error fetch historial', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
    };

    const handleClearFilters = () => {
        setFechaFrom('');
        setFechaTo('');
        setTipoServicio('');
        setPage(1);
    };

    const handleGenerateReport = async () => {
        if (!maquinaId || !canGenerateReport) return;

        setReporting(true);
        try {
            const token = localStorage.getItem('srmm_token') || '';
            const headers = { 'Authorization': `Bearer ${token}` };
            const params = new URLSearchParams({ format: 'csv' });
            if (fechaFrom) params.append('fecha_inicio', fechaFrom);
            if (fechaTo) params.append('fecha_fin', fechaTo);
            if (tipoServicio) params.append('tipo_servicio', tipoServicio);

            const res = await fetch(`/api/mantenimientos/maquina/${maquinaId}/historial?${params.toString()}`, { headers });
            if (!res.ok) throw new Error('No se pudo generar el reporte');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `historial_mantenciones_maquina_${maquinaId}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generando reporte', error);
        } finally {
            setReporting(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (!maquinaId || !canGenerateReport) return;

        setReporting(true);
        try {
            const jsPDF = await loadJsPdf();
            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            const machineLabel = String(maquinaId);
            const filters = [
                fechaFrom ? `Desde: ${fechaFrom}` : null,
                fechaTo ? `Hasta: ${fechaTo}` : null,
                tipoServicio ? `Tipo: ${tipoServicio}` : null,
            ].filter(Boolean).join(' | ') || 'Sin filtros';

            doc.setFontSize(16);
            doc.text('Historial de Horómetro y Mantenciones', 40, 40);
            doc.setFontSize(10);
            doc.text(`Máquina: ${machineLabel}`, 40, 60);
            doc.text(filters, 40, 76);
            doc.text(`Total de registros: ${total}`, 40, 92);

            const headers = ['Fecha', 'Máquina', 'Tipo', 'Horómetro', 'Usuario', 'Arriendo'];
            let y = 120;
            doc.setFontSize(11);
            doc.text(headers.join(' | '), 40, y);
            y += 18;

            rows.forEach((r) => {
                const line = [
                    new Date(r.fecha_registro).toLocaleDateString('es-CL'),
                    r.modelo_equipo || r.maquinaria_id_maquina,
                    r.tipo_servicio || '-',
                    `${r.valor_horas} hrs`,
                    r.id_usuario,
                    r.arriendos_id_contrato || '-',
                ].map((value) => String(value).slice(0, 28)).join(' | ');

                if (y > 520) {
                    doc.addPage();
                    y = 40;
                }

                doc.text(line, 40, y);
                y += 16;
            });

            doc.save(`historial_mantenciones_maquina_${maquinaId}.pdf`);
        } catch (error) {
            console.error('Error generando PDF', error);
        } finally {
            setReporting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return (
        <div className="bg-white p-6 rounded-2xl shadow border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Historial de Horómetro y Mantenciones</h3>

            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <input type="date" value={fechaFrom} onChange={(e) => setFechaFrom(e.target.value)} className="p-2 border rounded" />
                <input type="date" value={fechaTo} onChange={(e) => setFechaTo(e.target.value)} className="p-2 border rounded" />
                <select value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)} className="p-2 border rounded">
                    <option value="">Todos los tipos de servicio</option>
                    {serviceTypes.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                </select>
                <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Buscar</button>
                    <button type="button" onClick={handleClearFilters} className="px-4 py-2 border rounded text-slate-700">Limpiar</button>
                </div>
            </form>

            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <label>Orden:</label>
                    <select value={order} onChange={(e) => setOrder(e.target.value)} className="p-2 border rounded">
                        <option value="desc">Más reciente primero</option>
                        <option value="asc">Más antiguo primero</option>
                    </select>
                    <label>Registros por página:</label>
                    <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="p-2 border rounded">
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                </div>
                <div className="text-sm text-slate-500">Total: {total}</div>
            </div>

            {canGenerateReport && (
                <div className="mb-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleGenerateReport}
                        disabled={reporting || !maquinaId}
                        className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-60"
                    >
                        {reporting ? 'Generando...' : 'Generar reporte CSV'}
                    </button>
                    <button
                        type="button"
                        onClick={handleGeneratePdf}
                        disabled={reporting || !maquinaId}
                        className="px-4 py-2 bg-slate-700 text-white rounded disabled:opacity-60"
                    >
                        {reporting ? 'Generando...' : 'Generar PDF'}
                    </button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 text-sm text-slate-500 uppercase">
                            <th className="pb-3 px-2">Fecha</th>
                            <th className="pb-3 px-2">Máquina</th>
                            <th className="pb-3 px-2">Tipo de servicio</th>
                            <th className="pb-3 px-2">Horómetro</th>
                            <th className="pb-3 px-2">Usuario</th>
                            <th className="pb-3 px-2">Arriendo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="py-4 text-center">Cargando...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan="6" className="py-4 text-center text-slate-500">No hay registros</td></tr>
                        ) : (
                            rows.map(r => (
                                <tr key={r.id_registro} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                    <td className="py-3 px-2">{new Date(r.fecha_registro).toLocaleDateString('es-CL')}</td>
                                    <td className="py-3 px-2">{r.modelo_equipo || r.maquinaria_id_maquina}</td>
                                    <td className="py-3 px-2">{r.tipo_servicio || '-'}</td>
                                    <td className="py-3 px-2">{r.valor_horas} hrs</td>
                                    <td className="py-3 px-2">{r.id_usuario}</td>
                                    <td className="py-3 px-2">{r.arriendos_id_contrato || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded mr-2">Anterior</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 border rounded">Siguiente</button>
                </div>
                <div className="text-sm text-slate-500">Página {page} de {totalPages}</div>
            </div>
        </div>
    );
}
