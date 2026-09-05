(function () {
  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function canResolveIncidencias() {
    if (typeof window.hasCurrentRole === 'function') {
      return window.hasCurrentRole('Mecanico') || window.hasCurrentRole('Administrador');
    }

    const roleFromGetter = typeof window.getCurrentRole === 'function' ? window.getCurrentRole() : '';
    const roleFromUserVar = typeof userRole !== 'undefined' ? userRole : '';
    const roleFromCurrentUser = typeof currentUser !== 'undefined' ? currentUser?.rol_acceso : '';
    const role = normalizeRole(roleFromGetter || roleFromUserVar || roleFromCurrentUser);

    return role === 'mecanico' || role === 'administrador';
  }

  function shouldShowReportWarningColumn() {
    return Boolean(document.getElementById('reportFallasShowWarning')?.checked);
  }

  function renderReportFallasTable(rows) {
    const container = document.getElementById('reportFallasTable');
    if (!container) return;
    const showWarning = shouldShowReportWarningColumn();

    if (!rows.length) {
      container.innerHTML = '<p class="muted">No hay fallas para los filtros seleccionados.</p>';
      return;
    }

    container.innerHTML = `
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-slate-200 text-sm text-slate-500 uppercase">
                    <th class="pb-3 px-2">Máquina</th>
                    <th class="pb-3 px-2">Período</th>
                    <th class="pb-3 px-2">Criticidad</th>
                    <th class="pb-3 px-2">Total fallas</th>
                    <th class="pb-3 px-2">Resueltas</th>
                    <th class="pb-3 px-2">Pendientes</th>
                    ${showWarning ? '<th class="pb-3 px-2">Advertencia</th>' : ''}
                    <th class="pb-3 px-2">Prom. resolución</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((item) => `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition align-top">
                        <td class="py-3 px-2">${item.modelo_equipo || '—'}</td>
                        <td class="py-3 px-2 whitespace-nowrap">${formatCLDate(item.periodo_bucket)}</td>
                        <td class="py-3 px-2 font-semibold text-slate-700">${item.criticidad || '—'}</td>
                        <td class="py-3 px-2">${formatNumber(item.total_fallas)}</td>
                        <td class="py-3 px-2">${formatNumber(item.total_resueltas)}</td>
                        <td class="py-3 px-2">${formatNumber(item.total_pendientes)}</td>
                        ${showWarning ? `<td class="py-3 px-2">${Number(item.total_vinculadas || 0) > 0 ? `Sí (${formatNumber(item.total_vinculadas)})` : 'No'}</td>` : ''}
                        <td class="py-3 px-2 whitespace-nowrap">${formatNumber(item.promedio_resolucion_horas, ' hrs')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  }

  function renderReportFallasCharts(resumen) {
    const criticidadCanvas = document.getElementById('reportFallasCriticidadChart');
    const periodoCanvas = document.getElementById('reportFallasPeriodoChart');
    if (!window.Chart) return;

    if (window.reportFallasCriticidadChart) {
      window.reportFallasCriticidadChart.destroy();
      window.reportFallasCriticidadChart = null;
    }
    if (window.reportFallasPeriodoChart) {
      window.reportFallasPeriodoChart.destroy();
      window.reportFallasPeriodoChart = null;
    }

    const criticidadLabels = (resumen?.por_criticidad || []).map((item) => item.label);
    const criticidadValues = (resumen?.por_criticidad || []).map((item) => Number(item.total) || 0);
    const periodoLabels = (resumen?.por_periodo || []).map((item) => item.label);
    const periodoValues = (resumen?.por_periodo || []).map((item) => Number(item.total) || 0);

    if (criticidadCanvas) {
      window.reportFallasCriticidadChart = new Chart(criticidadCanvas, {
        type: 'bar',
        data: {
          labels: criticidadLabels,
          datasets: [{
            label: 'Fallas',
            data: criticidadValues,
            backgroundColor: ['#dc2626', '#d97706', '#16a34a'],
            borderRadius: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Fallas: ${Number(context.parsed.y || 0).toLocaleString('es-CL')}`
              }
            }
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#6b7280' } },
            x: { ticks: { color: '#6b7280' } }
          }
        }
      });
    }

    if (periodoCanvas) {
      window.reportFallasPeriodoChart = new Chart(periodoCanvas, {
        type: 'line',
        data: {
          labels: periodoLabels,
          datasets: [{
            label: 'Fallas por período',
            data: periodoValues,
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.12)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#4f46e5'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Fallas: ${Number(context.parsed.y || 0).toLocaleString('es-CL')}`
              }
            }
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#6b7280' } },
            x: { ticks: { color: '#6b7280' } }
          }
        }
      });
    }
  }

  async function loadGlobalIncidencias() {
    const container = document.getElementById('reportIncidenciasGlobal');
    if (!container) return;
    container.innerHTML = '<p class="muted">Cargando incidencias…</p>';
    try {
      const machineIds = getSelectedReportMachineIds(document.getElementById('reportMachineSelect'));
      const criticidad = document.getElementById('reportFallasCriticidad')?.value || '';
      const q = new URLSearchParams();
      if (machineIds.length) q.append('maquina_ids', machineIds.join(','));
      if (criticidad) q.append('criticidad', criticidad);
      if (document.getElementById('reportFallasPeriodo')?.value === 'personalizado') {
        const s = document.getElementById('reportFallasStartDate')?.value;
        const e = document.getElementById('reportFallasEndDate')?.value;
        if (s) q.append('fecha_inicio', s);
        if (e) q.append('fecha_fin', e);
      }
      const res = await fetch(`/api/incidencias?${q.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('No se pudieron cargar las incidencias globales');
      const rows = await res.json();
      renderGlobalIncidenciasTable(rows);
    } catch (err) {
      container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
    }
  }

  function renderGlobalIncidenciasTable(rows) {
    const container = document.getElementById('reportIncidenciasGlobal');
    if (!container) return;
    const canResolve = canResolveIncidencias();
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="muted">No hay incidencias para los filtros seleccionados.</p>';
      return;
    }
    container.innerHTML = `
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-slate-200 text-sm text-slate-500 uppercase">
                    <th class="pb-3 px-2">Fecha</th>
                    <th class="pb-3 px-2">Máquina</th>
                    <th class="pb-3 px-2">Criticidad</th>
                    <th class="pb-3 px-2">Descripción</th>
                    <th class="pb-3 px-2">Vinculada</th>
                    <th class="pb-3 px-2">Mantenimiento</th>
                    <th class="pb-3 px-2">Operador</th>
                    <th class="pb-3 px-2">Estado</th>
                    <th class="pb-3 px-2">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((r) => `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition align-top">
                        <td class="py-3 px-2 whitespace-nowrap">${new Date(r.fecha).toLocaleDateString('es-CL')}</td>
                        <td class="py-3 px-2">${escapeHtml(r.modelo_equipo || '—')}</td>
                        <td class="py-3 px-2">${escapeHtml(r.criticidad || '—')}</td>
                        <td class="py-3 px-2">${escapeHtml(r.descripcion || '—')}</td>
                        <td class="py-3 px-2">${r.vinculada_mantenimiento ? 'Sí' : 'No'}</td>
                        <td class="py-3 px-2">${r.mantenimiento_id ? `<a href="#" onclick="openMaintenanceById(${r.mantenimiento_id});return false;">#${r.mantenimiento_id}</a>` : '—'}</td>
                        <td class="py-3 px-2">${escapeHtml(r.operador_nombre || `#${r.operador_id || ''}`)}</td>
                        <td class="py-3 px-2">${escapeHtml(r.estado || '—')}</td>
                        <td class="py-3 px-2">${canResolve
                          ? (String(r.estado || '').toLowerCase() === 'resuelta'
                            ? '<span class="muted">Resuelta</span>'
                            : `<button class="btn btn-secondary" type="button" onclick="resolveIncidenciaById(${Number(r.id_incidencia)})">Resolver</button>`)
                          : '<span class="muted">—</span>'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  }

  function buildFallasPrintableHtml() {
    const resumen = window.reportFallasState.resumen || {};
    const rows = Array.isArray(window.reportFallasState.rows) ? window.reportFallasState.rows : [];
    const filtros = window.reportFallasState.filtros || {};
    const title = 'Reporte de fallas';
    const generatedAt = new Date().toLocaleString('es-CL');
    const machineSelect = document.getElementById('reportMachineSelect');
    const selectedLabels = Array.from(machineSelect?.selectedOptions || []).map((option) => option.textContent).filter(Boolean);
    const showWarning = shouldShowReportWarningColumn();

    const rowsHtml = rows.map((item) => `
        <tr>
            <td>${escapeHtml(item.modelo_equipo || '—')}</td>
            <td>${escapeHtml(formatCLDate(item.periodo_bucket))}</td>
            <td>${escapeHtml(item.criticidad || '—')}</td>
            <td>${escapeHtml(String(item.total_fallas ?? 0))}</td>
            <td>${escapeHtml(String(item.total_resueltas ?? 0))}</td>
            <td>${escapeHtml(String(item.total_pendientes ?? 0))}</td>
            ${showWarning ? `<td>${escapeHtml(Number(item.total_vinculadas || 0) > 0 ? `Sí (${item.total_vinculadas})` : 'No')}</td>` : ''}
            <td>${escapeHtml(formatNumber(item.promedio_resolucion_horas, ' hrs'))}</td>
        </tr>
    `).join('');

    return `
        <div class="print-header">
            <img src="/favicon.svg" class="print-logo" alt="Logo">
            <div>
                <div class="print-title">${title}</div>
                <div class="print-meta">Generado: ${generatedAt}</div>
                <div class="print-meta">Período: ${escapeHtml(String(filtros.periodo || 'mensual'))} · Criticidad: ${escapeHtml(String(filtros.criticidad || 'todas'))}</div>
                <div class="print-meta">Máquinas: ${escapeHtml(selectedLabels.length ? selectedLabels.join(', ') : 'Todas')}</div>
            </div>
        </div>
        <div class="print-summary">
            <div>Total fallas: ${escapeHtml(String(resumen.total_fallas ?? 0))}</div>
            <div>Resueltas: ${escapeHtml(String(resumen.total_resueltas ?? 0))}</div>
            <div>Pendientes: ${escapeHtml(String(resumen.total_pendientes ?? 0))}</div>
            <div>Promedio resolución: ${escapeHtml(formatNumber(resumen.promedio_resolucion_horas, ' hrs'))}</div>
            <div>Máquina con más fallas: ${escapeHtml(resumen.maquina_con_mas_fallas ? `${resumen.maquina_con_mas_fallas.modelo_equipo} (${resumen.maquina_con_mas_fallas.total_fallas})` : '—')}</div>
        </div>
        <table>
            <thead>
                <tr><th>Máquina</th><th>Período</th><th>Criticidad</th><th>Total</th><th>Resueltas</th><th>Pendientes</th>${showWarning ? '<th>Advertencia</th>' : ''}<th>Prom. resolución</th></tr>
            </thead>
            <tbody>${rowsHtml || `<tr><td colspan="${showWarning ? 8 : 7}">Sin datos</td></tr>`}</tbody>
        </table>
    `;
  }

  function openReportFallasPrintWindow() {
    const win = window.open('', '_blank');
    if (!win) {
      setReportStatus('No se pudo abrir ventana de impresión', 'error');
      return;
    }

    const styles = `
        body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #191919; padding: 24px; }
        .print-header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
        .print-logo { width:72px; height:72px; object-fit:contain; }
        .print-title { font-size:18px; font-weight:800; margin:0; }
        .print-meta { color:#666; margin-top:6px; font-size:13px; }
        .print-summary { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin: 16px 0; padding: 12px; border: 1px solid #eee; border-radius: 12px; background: #fafafa; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #eee; padding: 8px 10px; text-align: left; font-size: 12px; }
        th { background: #f7f7f7; font-weight: 700; }
        @media print {
            button { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
        }
    `;

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte de fallas</title><style>${styles}</style></head><body>${buildFallasPrintableHtml()}<div style="margin-top:18px; display:flex; gap:8px;"><button onclick="window.print();">Imprimir</button><button onclick="window.close();">Cerrar</button></div></body></html>`);
    win.document.close();
  }

  async function loadReportFallasDashboard() {
    const periodoSelect = document.getElementById('reportFallasPeriodo');
    const startDateInput = document.getElementById('reportFallasStartDate');
    const endDateInput = document.getElementById('reportFallasEndDate');
    const criticidadSelect = document.getElementById('reportFallasCriticidad');
    const statusBadge = document.getElementById('reportFallasStatus');
    const totalEl = document.getElementById('reportFallasTotal');
    const topMachineEl = document.getElementById('reportFallasTopMachine');
    const avgEl = document.getElementById('reportFallasAvgResolution');
    const pendingEl = document.getElementById('reportFallasPending');

    if (!periodoSelect || !startDateInput || !endDateInput || !criticidadSelect) return;

    try {
      setReportStatus('Cargando reporte de fallas...', 'info');
      if (statusBadge) {
        statusBadge.textContent = 'Cargando...';
        statusBadge.style.background = 'rgba(217,119,6,0.14)';
        statusBadge.style.color = '#d97706';
      }

      const q = new URLSearchParams();
      const periodo = periodoSelect.value || 'mensual';
      const machineIds = getSelectedReportMachineIds(document.getElementById('reportMachineSelect'));
      const criticidad = criticidadSelect.value;

      q.append('periodo', periodo);
      if (machineIds.length) q.append('maquinaria_ids', machineIds.join(','));
      if (criticidad) q.append('criticidad', criticidad);
      if (periodo === 'personalizado') {
        if (startDateInput.value) q.append('fecha_inicio', startDateInput.value);
        if (endDateInput.value) q.append('fecha_fin', endDateInput.value);
      }

      const showWarning = shouldShowReportWarningColumn();
      if (showWarning) q.append('mostrar_advertencia', 'true');

      const currentRole = typeof userRole !== 'undefined' ? userRole : '';
      const endpoint = currentRole === 'Operador' ? '/api/reportes/fallas/propias' : '/api/reportes/fallas';
      const res = await fetch(`${endpoint}?${q.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(e.message || 'No se pudo cargar el reporte de fallas');
      }

      const payload = await res.json();
      const resumen = payload.resumen || {};
      const rows = Array.isArray(payload.agrupados) ? payload.agrupados : [];

      window.reportFallasState = { rows, resumen, filtros: payload.filtros || {} };

      if (totalEl) totalEl.textContent = formatNumber(resumen.total_fallas);
      if (topMachineEl) topMachineEl.textContent = resumen.maquina_con_mas_fallas ? `${resumen.maquina_con_mas_fallas.modelo_equipo} (${formatNumber(resumen.maquina_con_mas_fallas.total_fallas)})` : '—';
      if (avgEl) avgEl.textContent = formatNumber(resumen.promedio_resolucion_horas, ' hrs');
      if (pendingEl) pendingEl.textContent = formatNumber(resumen.total_pendientes);

      try {
        const interpEl = document.getElementById('reportFallasInterpretation');
        if (interpEl) {
          const tot = Number(resumen.total_fallas || 0);
          const pct = Number(resumen.porcentaje_vinculadas || 0);
          if (tot > 0) {
            interpEl.style.display = 'block';
            const vinc = Number(resumen.total_vinculadas || 0);
            interpEl.textContent = (vinc > 0)
              ? `⚠️ ${vinc} de ${tot} fallas (${pct}%) ocurrieron con mantenimiento vencido en el período seleccionado.`
              : `✔ 0 de ${tot} fallas (0%) ocurrieron con mantenimiento vencido en el período seleccionado.`;
          } else {
            interpEl.style.display = 'none';
            interpEl.textContent = '';
          }
        }
      } catch (e) { /* no bloquear la renderización principal */ }

      renderReportFallasCharts(resumen);
      renderReportFallasTable(rows);

      if (currentRole !== 'Operador') {
        try {
          await loadGlobalIncidencias();
        } catch (e) {
          console.error('No se pudo cargar incidencias globales:', e);
        }
      } else {
        const globalIncidencias = document.getElementById('reportIncidenciasGlobal');
        if (globalIncidencias) {
          globalIncidencias.innerHTML = '';
        }
      }

      if (statusBadge) {
        statusBadge.textContent = 'Actualizado';
        statusBadge.style.background = 'rgba(39,174,96,0.14)';
        statusBadge.style.color = '#27ae60';
      }

      setReportStatus('Reporte de fallas actualizado', 'success');
    } catch (error) {
      console.error('Error cargando reporte de fallas:', error);
      if (statusBadge) {
        statusBadge.textContent = 'Error';
        statusBadge.style.background = 'rgba(231,76,60,0.14)';
        statusBadge.style.color = '#c0392b';
      }
      setReportStatus('No se pudo cargar el reporte de fallas', 'error');
    }
  }

  window.ReportesFallasModule = {
    shouldShowReportWarningColumn,
    renderReportFallasTable,
    renderReportFallasCharts,
    loadGlobalIncidencias,
    renderGlobalIncidenciasTable,
    buildFallasPrintableHtml,
    openReportFallasPrintWindow,
    loadReportFallasDashboard,
  };
})();