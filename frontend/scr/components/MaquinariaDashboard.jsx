import React, { useEffect, useMemo, useState } from 'react';

function decodeUserRole() {
    try {
        const token = localStorage.getItem('srmm_token') || '';
        if (!token || !token.includes('.')) return '';
        const payload = token.split('.')[1];
        const parsed = JSON.parse(atob(payload));
        return parsed.rol_acceso || '';
    } catch (error) {
        console.error('Error leyendo rol de usuario', error);
        return '';
    }
}

function formatCurrency(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0';
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(numeric);
}

function formatNumber(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0';
    return numeric.toLocaleString('es-CL');
}

export default function MaquinariaDashboard() {
    const [currentRole, setCurrentRole] = useState('');
    const [maquinaria, setMaquinaria] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [formStatus, setFormStatus] = useState('');
    const [formMode, setFormMode] = useState('create');
    const [formData, setFormData] = useState({
        modelo_equipo: '',
        horometro_actual: '',
        estado: 'Disponible',
        especificaciones: '',
        planes_mantencion_id_plan: '',
        tarifa_diaria: ''
    });

    const isAdmin = useMemo(() => currentRole === 'Administrador', [currentRole]);

    useEffect(() => {
        setCurrentRole(decodeUserRole());
    }, []);

    const loadMaquinaria = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('srmm_token') || '';
            const res = await fetch('/api/maquinaria', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error('No se pudo cargar la maquinaria');
            }

            const data = await res.json();
            setMaquinaria(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setFormStatus(error.message || 'Error al cargar maquinaria');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMaquinaria();
    }, []);

    const resetForm = () => {
        setSelectedMachineId('');
        setFormMode('create');
        setFormData({
            modelo_equipo: '',
            horometro_actual: '',
            estado: 'Disponible',
            especificaciones: '',
            planes_mantencion_id_plan: '',
            tarifa_diaria: ''
        });
        setFormStatus('');
    };

    const handleSelectMachine = (machineId) => {
        setSelectedMachineId(machineId);
        const selected = maquinaria.find((item) => String(item.id_maquina) === String(machineId));
        if (!selected) return;

        setFormMode('edit');
        setFormData({
            modelo_equipo: selected.modelo_equipo || '',
            horometro_actual: selected.horometro_actual ?? '',
            estado: selected.estado || 'Disponible',
            especificaciones: selected.especificaciones || '',
            planes_mantencion_id_plan: selected.planes_mantencion_id_plan ?? '',
            tarifa_diaria: selected.tarifa_diaria ?? ''
        });
        setFormStatus(`Editando ${selected.modelo_equipo}`);
    };

    const handleChange = (field) => (event) => {
        setFormData((prev) => ({
            ...prev,
            [field]: event.target.value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!isAdmin) {
            setFormStatus('No tienes permisos para modificar maquinaria');
            return;
        }

        if (!formData.modelo_equipo.trim()) {
            setFormStatus('El modelo es obligatorio');
            return;
        }

        const token = localStorage.getItem('srmm_token') || '';
        const payload = {
            modelo_equipo: formData.modelo_equipo.trim(),
            horometro_actual: formData.horometro_actual,
            estado: formData.estado,
            especificaciones: formData.especificaciones.trim(),
            planes_mantencion_id_plan: formData.planes_mantencion_id_plan === '' ? null : formData.planes_mantencion_id_plan,
            tarifa_diaria: formData.tarifa_diaria === '' ? null : formData.tarifa_diaria
        };

        try {
            const url = formMode === 'edit' && selectedMachineId
                ? `/api/maquinaria/${selectedMachineId}`
                : '/api/maquinaria';
            const method = formMode === 'edit' && selectedMachineId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorPayload = await res.json().catch(() => ({ message: 'No se pudo guardar la maquinaria' }));
                throw new Error(errorPayload.message || 'No se pudo guardar la maquinaria');
            }

            const saved = await res.json();
            setFormStatus(formMode === 'edit'
                ? `Maquinaria actualizada: ${saved.modelo_equipo}`
                : `Maquinaria creada: ${saved.modelo_equipo}`);
            await loadMaquinaria();

            if (formMode === 'create') {
                resetForm();
            } else {
                setFormData((prev) => ({
                    ...prev,
                    tarifa_diaria: saved.tarifa_diaria ?? prev.tarifa_diaria
                }));
            }
        } catch (error) {
            console.error(error);
            setFormStatus(error.message || 'Error al guardar maquinaria');
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fadeIn">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Maquinaria</h2>
                    <p className="text-sm text-slate-500 mt-1">Vista común para todos los roles y edición habilitada solo para administrador.</p>
                </div>
                <div className="text-sm text-slate-500">
                    Rol actual: <span className="font-semibold text-slate-700">{currentRole || 'No detectado'}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow border border-slate-100 lg:col-span-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Listado de maquinaria</h3>
                            <p className="text-sm text-slate-500">Cualquier rol puede consultar los equipos y sus tarifas; solo admin puede editarlas.</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadMaquinaria}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                        >
                            Refrescar
                        </button>
                    </div>

                    <div className="overflow-x-auto max-h-[34rem]">
                        <table className="w-full min-w-full text-left border-collapse table-auto">
                            <thead>
                                <tr className="border-b border-slate-200 text-sm text-slate-500 uppercase">
                                    <th className="pb-3 px-2">Modelo</th>
                                    <th className="pb-3 px-2 text-center">Estado</th>
                                    <th className="pb-3 px-2 text-center">Horómetro</th>
                                    <th className="pb-3 px-2 text-right">Tarifa diaria</th>
                                    <th className="pb-3 px-2 text-center">Plan</th>
                                    <th className="pb-3 px-2 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="py-4 text-center text-slate-500">Cargando maquinaria...</td>
                                    </tr>
                                ) : maquinaria.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-4 text-center text-slate-500">No hay maquinaria registrada.</td>
                                    </tr>
                                ) : (
                                    maquinaria.map((machine) => (
                                        <tr key={machine.id_maquina} className="border-b border-slate-100 hover:bg-slate-50 transition align-top">
                                            <td className="py-3 px-2 font-semibold text-slate-700">{machine.modelo_equipo}</td>
                                            <td className="py-3 px-2 text-center">{machine.estado}</td>
                                            <td className="py-3 px-2 text-center">{formatNumber(machine.horometro_actual)} hrs</td>
                                            <td className="py-3 px-2 text-right">{formatCurrency(machine.tarifa_diaria || 0)}</td>
                                            <td className="py-3 px-2 text-center">{machine.planes_mantencion_id_plan || '—'}</td>
                                            <td className="py-3 px-2 text-center">
                                                {isAdmin ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectMachine(machine.id_maquina)}
                                                        className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm"
                                                    >
                                                        Editar
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-500">Solo lectura</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow border border-slate-100">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{isAdmin ? 'Crear / editar' : 'Información de equipo'}</h3>
                            <p className="text-sm text-slate-500">{isAdmin ? 'La tarifa solo puede cambiarla un administrador.' : 'Tu perfil no permite editar tarifas.'}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-700">Modelo</span>
                            <input
                                type="text"
                                value={formData.modelo_equipo}
                                onChange={handleChange('modelo_equipo')}
                                disabled={!isAdmin}
                                className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-70"
                                placeholder="Ej. Excavadora CAT 320"
                            />
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-700">Horómetro</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.horometro_actual}
                                    onChange={handleChange('horometro_actual')}
                                    disabled={!isAdmin}
                                    className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-70"
                                />
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-700">Estado</span>
                                <select
                                    value={formData.estado}
                                    onChange={handleChange('estado')}
                                    disabled={!isAdmin}
                                    className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-70"
                                >
                                    <option value="Disponible">Disponible</option>
                                    <option value="Arrendada">Arrendada</option>
                                    <option value="Mantencion">Mantención</option>
                                    <option value="Bloqueada">Bloqueada</option>
                                    <option value="No Operativa">No Operativa</option>
                                </select>
                            </label>
                        </div>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-700">Tarifa diaria</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.tarifa_diaria}
                                onChange={handleChange('tarifa_diaria')}
                                disabled={!isAdmin}
                                className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-70"
                                placeholder="100000"
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-700">Plan mantención ID</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={formData.planes_mantencion_id_plan}
                                onChange={handleChange('planes_mantencion_id_plan')}
                                disabled={!isAdmin}
                                className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-70"
                                placeholder="Opcional"
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-700">Especificaciones</span>
                            <textarea
                                value={formData.especificaciones}
                                onChange={handleChange('especificaciones')}
                                disabled={!isAdmin}
                                className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 min-h-[120px] disabled:opacity-70"
                                placeholder="Marca, serie, accesorios, notas técnicas"
                            />
                        </label>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="submit"
                                disabled={!isAdmin}
                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-60"
                            >
                                {formMode === 'edit' ? 'Actualizar' : 'Crear'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                            >
                                Limpiar
                            </button>
                        </div>
                    </form>

                    <div className="mt-4 text-sm text-slate-600">
                        Tarifa base para máquinas sin valor propio: {formatCurrency(100000)}
                    </div>

                    {formStatus ? (
                        <div className="mt-4 text-sm font-semibold text-slate-700">{formStatus}</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
