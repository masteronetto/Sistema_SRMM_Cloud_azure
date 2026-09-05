(function () {
  function getSelectedReportMachineIds(machineSelect) {
    return Array.from(machineSelect?.selectedOptions || [])
      .map((option) => String(option.value))
      .filter(Boolean);
  }

  function updateReportKpis(summary) {
    const horasEl = document.getElementById('reportHorasHistoricas');
    const detalleEl = document.getElementById('reportHorasDetalle');
    const mantencionesEl = document.getElementById('reportTotalMantenciones');
    const fallasEl = document.getElementById('reportTotalFallas');
    const ingresosEl = document.getElementById('reportTotalIngresos');

    if (horasEl) horasEl.textContent = formatNumber(summary.totalHoras, ' hrs');
    if (detalleEl) detalleEl.textContent = summary.detalle;
    if (mantencionesEl) mantencionesEl.textContent = formatNumber(summary.totalMantenciones);
    if (fallasEl) fallasEl.textContent = formatNumber(summary.totalFallas);
    if (ingresosEl) ingresosEl.textContent = formatCurrency(summary.totalIngresos || 0);
  }

  function renderOperatorResumen(summary) {
    const card = document.getElementById('operatorResumenCard');
    const horasEl = document.getElementById('operatorResumenHoras');
    const incidenciasEl = document.getElementById('operatorResumenIncidencias');
    const maquinasEl = document.getElementById('operatorResumenMaquinas');
    const contratoEl = document.getElementById('operatorResumenContrato');
    const maquinaActualEl = document.getElementById('operatorResumenMaquinaActual');

    if (!card) return;

    if (!summary) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';
    if (horasEl) horasEl.textContent = formatNumber(summary.horas_registradas, ' hrs');
    if (incidenciasEl) incidenciasEl.textContent = formatNumber(summary.incidencias_registradas);
    if (maquinasEl) maquinasEl.textContent = formatNumber(summary.maquinas_asignadas);

    if (contratoEl) {
      contratoEl.textContent = summary.asignaciones_activas > 0 ? 'Activa' : 'Sin asignación';
    }

    if (maquinaActualEl) {
      const assignment = summary.asignacion_activa || summary.contrato_activo;
      maquinaActualEl.textContent = assignment
        ? `${assignment.modelo_equipo || 'Máquina'} · ${assignment.fecha_inicio || '—'} a ${assignment.fecha_fin || '—'}`
        : 'Sin asignación activa';
    }
  }

  async function loadOperatorResumen(headers) {
    const response = await fetch('/api/reportes/operador/resumen', { headers });
    if (!response.ok) {
      throw new Error('No se pudo cargar el resumen operativo');
    }

    return response.json();
  }

  async function loadSelectedMachineReport(machineId, fechaInicio, fechaFin) {
    const selectedIds = machineId ? [machineId] : [];
    return loadSelectedMachinesReport(selectedIds, fechaInicio, fechaFin);
  }

  async function loadSelectedMachinesReport(machineIds, fechaInicio, fechaFin) {
    const selectedLabel = document.getElementById('reportSelectedMachineLabel');
    const headers = getAuthHeaders();
    const ids = Array.isArray(machineIds) ? machineIds.filter(Boolean).map(String) : [];
    const effectiveIds = ids.length ? ids : availableMachines.map((item) => String(item.id_maquina)).filter(Boolean);
    const query = new URLSearchParams();
    if (fechaInicio) query.append('fecha_inicio', fechaInicio);
    if (fechaFin) query.append('fecha_fin', fechaFin);

    if (!effectiveIds.length) {
      window.__srmmReporteState = { rows: [], totalHoras: 0, totalMantenciones: 0, totalFallas: 0, detalle: 'No hay máquinas disponibles para reportar.' };
      if (selectedLabel) selectedLabel.textContent = 'Sin máquinas disponibles';
      renderReportUsoChart([]);
      renderReportTable([]);
      return;
    }

    const labelMap = new Map(availableMachines.map((item) => [String(item.id_maquina), item.modelo_equipo]));
    const seriesResults = await Promise.all(effectiveIds.map(async (idMaquina) => {
      const res = await fetch(`/api/reportes/historial-unificado/${idMaquina}?${query.toString()}`, { headers });
      if (!res.ok) throw new Error(`No se pudo cargar el historial unificado de la máquina ${idMaquina}`);
      const rows = await res.json();
      return {
        id: String(idMaquina),
        label: labelMap.get(String(idMaquina)) || `Máquina #${idMaquina}`,
        rows
      };
    }));

    const rows = seriesResults.flatMap((series) => series.rows.map((row) => ({ ...row, maquina_label: series.label, maquinaria_id_maquina: row.maquinaria_id_maquina || series.id })));
    const totalHoras = rows.reduce((acc, item) => acc + (Number(item.horometro) || 0), 0);
    const totalMantenciones = rows.filter((item) => String(item.tipo_evento || '').startsWith('Mantención')).length;
    const totalFallas = rows.filter((item) => String(item.tipo_evento || '').includes('Falla')).length;

    window.__srmmReporteState = {
      rows,
      totalHoras,
      totalMantenciones,
      totalFallas,
      detalle: `${rows.length} evento(s) entre ${fechaInicio || 'inicio'} y ${fechaFin || 'hoy'} en ${effectiveIds.length} máquina(s)`,
      selectedMachineIds: effectiveIds
    };

    if (selectedLabel) {
      selectedLabel.textContent = ids.length === 0
        ? 'Todas las máquinas'
        : (ids.length === 1 ? (labelMap.get(ids[0]) || `Máquina #${ids[0]}`) : `${ids.length} máquinas seleccionadas`);
    }

    if (effectiveIds.length === 1) {
      renderReportUsoChart(seriesResults[0]?.rows || [], [seriesResults[0]?.label || 'Horómetro histórico']);
    } else {
      renderComparativeUsageChart(seriesResults);
    }

    renderReportTable(rows);
    reportSelectedMachineId = ids[0] || '';
  }

  async function loadReportesDashboard() {
    const machineSelect = document.getElementById('reportMachineSelect');
    const selectedLabel = document.getElementById('reportSelectedMachineLabel');

    if (!machineSelect) return;

    setReportStatus('Cargando reportes...', 'info');

    try {
      const machines = await loadAvailableMachines();

      machineSelect.innerHTML = machines.length
        ? [`<option value="">Todas las máquinas</option>`, ...machines.map((m) => `<option value="${m.id_maquina}">${m.modelo_equipo}</option>`)].join('')
        : '<option value="">No hay máquinas disponibles</option>';

      const initialIds = reportSelectedMachineId ? [String(reportSelectedMachineId)] : [];
      Array.from(machineSelect.options).forEach((option) => {
        option.selected = initialIds.includes(String(option.value));
      });

      const headers = getAuthHeaders();
      const role = typeof userRole !== 'undefined' ? userRole : '';
      const isOperator = role === 'Operador';
      const isAdmin = role === 'Administrador';
      const statsPromise = fetch('/api/reportes/estadisticas', { headers });
      const topPromise = isOperator ? Promise.resolve(null) : fetch('/api/reportes/top-maquinas', { headers });
      const [topRes, statsRes] = await Promise.all([topPromise, statsPromise]);

      if (topRes && !topRes.ok) throw new Error('No se pudieron cargar las máquinas más usadas');
      if (!statsRes.ok) throw new Error('No se pudieron cargar las estadísticas');

      const topMaquinas = isOperator ? machines : await topRes.json();
      const estadisticas = await statsRes.json();

      renderReportTopChart(topMaquinas);

      const selectedMachineIds = Array.from(machineSelect.selectedOptions).map((option) => String(option.value)).filter(Boolean);
      const selectedMachineStats = selectedMachineIds.length
        ? estadisticas.filter((item) => selectedMachineIds.includes(String(item.id_maquina)))
        : [];

      const summary = {
        totalHoras: 0,
        totalMantenciones: selectedMachineStats.reduce((acc, item) => acc + Number(item.total_mantenciones || 0), 0),
        totalFallas: selectedMachineStats.reduce((acc, item) => acc + Number(item.total_fallas || 0), 0),
        totalIngresos: 0,
        detalle: 'Selecciona una o varias máquinas para ver su evolución.'
      };

      const dates = getEffectiveReportDates();
      await loadSelectedMachinesReport(selectedMachineIds, dates.start, dates.end);

      if (selectedLabel) {
        selectedLabel.textContent = selectedMachineIds.length === 0
          ? 'Todas las máquinas'
          : selectedMachineIds.length === 1
          ? (machines.find((m) => String(m.id_maquina) === String(selectedMachineIds[0]))?.modelo_equipo || 'Máquina seleccionada')
          : (selectedMachineIds.length > 1 ? `${selectedMachineIds.length} máquinas seleccionadas` : 'Sin máquina seleccionada');
      }

      if (isOperator) {
        try {
          const operatorSummary = await loadOperatorResumen(headers);
          renderOperatorResumen(operatorSummary);
        } catch (summaryError) {
          console.error(summaryError);
          renderOperatorResumen(null);
        }
      } else {
        renderOperatorResumen(null);
      }

      const reportState = window.__srmmReporteState || {};
      if (reportState.totalHoras !== undefined) summary.totalHoras = reportState.totalHoras;
      if (reportState.totalMantenciones !== undefined) summary.totalMantenciones = reportState.totalMantenciones;
      if (reportState.totalFallas !== undefined) summary.totalFallas = reportState.totalFallas;
      if (reportState.detalle) summary.detalle = reportState.detalle;

      if (isAdmin) {
        try {
          const q = new URLSearchParams();
          const d = getEffectiveReportDates();
          if (d.start) q.append('fecha_inicio', d.start);
          if (d.end) q.append('fecha_fin', d.end);
          const ingRes = await fetch(`/api/reportes/ingresos?${q.toString()}`, { headers });
          if (ingRes.ok) {
            const ingPayload = await ingRes.json();
            summary.totalIngresos = Number(ingPayload.total_ingresos || 0);
          }
        } catch (e) {
          /* no bloquear la carga de KPIs */
        }
      }

      updateReportKpis(summary);
      await loadReportFallasDashboard();
      
      // Solo mostrar reportes de mantenimiento a Mecánicos y Administradores
      if (!isOperator) {
        try {
          const mantenimientosRes = await fetch('/api/reportes/mantenimientos', { headers });
          if (mantenimientosRes.ok) {
            const rows = await mantenimientosRes.json();
            // Aquí iría la renderización de mantenimientos si hubiera UI
            console.log('Reporte de mantenimientos cargado:', rows.length, 'máquinas');
          }
        } catch (error) {
          console.error('Error cargando reporte de mantenimientos:', error);
        }
      }
      
      setReportStatus('Reportes actualizados', 'success');
    } catch (error) {
      console.error('Error cargando reportes históricos:', error);
      setReportStatus('Error al cargar reportes', 'error');
    }
  }

  function getEffectiveReportDates() {
    const start = document.getElementById('globalStartDate')?.value || '';
    const end = document.getElementById('globalEndDate')?.value || '';
    return { start, end, useCustom: false };
  }

  function initReportesDashboard() {
    const machineSelect = document.getElementById('reportMachineSelect');
    const fallasPeriodoSelect = document.getElementById('reportFallasPeriodo');
    const fallasStartDateInput = document.getElementById('reportFallasStartDate');
    const fallasEndDateInput = document.getElementById('reportFallasEndDate');
    const fallasCriticidadSelect = document.getElementById('reportFallasCriticidad');
    const fallasWarningToggle = document.getElementById('reportFallasShowWarning');
    const refreshBtn = document.getElementById('reportRefreshBtn');
    const pdfBtn = document.getElementById('reportPdfBtn');
    const fallasRefreshBtn = document.getElementById('reportFallasRefreshBtn');
    const fallasPrintBtn = document.getElementById('reportFallasPrintBtn');

    if (!machineSelect || !refreshBtn || !pdfBtn) return;

    if (!reportsInitialized) {
      reportsInitialized = true;

      machineSelect.addEventListener('change', async () => {
        const selectedIds = getSelectedReportMachineIds(machineSelect);
        try {
          const d = getEffectiveReportDates();
          await loadSelectedMachinesReport(selectedIds, d.start, d.end);
          await loadReportFallasDashboard();
          reportSelectedMachineId = selectedIds[0] || '';
          setReportStatus(selectedIds.length === 0 ? 'Todas las máquinas actualizadas' : (selectedIds.length === 1 ? 'Máquina actualizada' : 'Máquinas actualizadas'), 'success');
        } catch (error) {
          console.error(error);
          setReportStatus('No se pudo actualizar la selección', 'error');
        }
      });

      if (fallasPeriodoSelect && fallasStartDateInput && fallasEndDateInput && fallasCriticidadSelect) {
        const syncFallasDateInputs = () => {
          const custom = fallasPeriodoSelect.value === 'personalizado';
          fallasStartDateInput.disabled = !custom;
          fallasEndDateInput.disabled = !custom;
          fallasStartDateInput.style.opacity = custom ? '1' : '0.6';
          fallasEndDateInput.style.opacity = custom ? '1' : '0.6';
        };

        fallasPeriodoSelect.addEventListener('change', async () => {
          syncFallasDateInputs();
          await loadReportFallasDashboard();
        });
        fallasStartDateInput.addEventListener('change', loadReportFallasDashboard);
        fallasEndDateInput.addEventListener('change', loadReportFallasDashboard);
        fallasCriticidadSelect.addEventListener('change', loadReportFallasDashboard);
        if (fallasWarningToggle) {
          fallasWarningToggle.addEventListener('change', loadReportFallasDashboard);
        }
        syncFallasDateInputs();
      }

      const toggleMultiBtn = document.getElementById('toggleMultiSelectBtn');
      const multiHelp = document.getElementById('reportMultiHelp');
      if (toggleMultiBtn) {
        toggleMultiBtn.classList.remove('active');
        machineSelect.multiple = false;
        machineSelect.size = 1;
        toggleMultiBtn.addEventListener('click', () => {
          const isActive = toggleMultiBtn.classList.toggle('active');
          if (isActive) {
            machineSelect.multiple = true;
            machineSelect.size = Math.min(8, Math.max(4, machines.length + 1));
            machineSelect.classList.add('is-multi');
            if (multiHelp) multiHelp.textContent = 'Multiselección activada — selecciona una o varias máquinas.';
          } else {
            machineSelect.multiple = false;
            machineSelect.size = 1;
            machineSelect.classList.remove('is-multi');
            const first = machineSelect.selectedOptions[0];
            Array.from(machineSelect.options).forEach((opt) => {
              opt.selected = first ? String(opt.value) === String(first.value) : false;
            });
            if (multiHelp) multiHelp.textContent = "Pulsa 'Seleccionar varias' para activar multiselección.";
          }
        });
      }

      refreshBtn.addEventListener('click', async () => {
        try {
          destroyReportCharts();
          await loadReportesDashboard();
        } catch (error) {
          console.error(error);
          setReportStatus('No se pudo refrescar el reporte', 'error');
        }
      });

      pdfBtn.addEventListener('click', () => {
        const reportState = window.__srmmReporteState || {};
        const rows = Array.isArray(reportState.rows) ? reportState.rows : [];
        const jsPDF = window.jspdf && window.jspdf.jsPDF;
        const selectedIds = getSelectedReportMachineIds(machineSelect);

        if (!jsPDF) {
          setReportStatus('No se pudo cargar jsPDF', 'error');
          return;
        }

        if (!rows.length) {
          setReportStatus('No hay datos para generar PDF', 'error');
          return;
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const title = 'Reporte histórico SRMM';
        const machineLabel = document.getElementById('reportSelectedMachineLabel')?.textContent || 'Sin máquina seleccionada';
        const d = getEffectiveReportDates();
        const startDate = d.start || 'inicio';
        const endDate = d.end || 'hoy';
        const summary = reportState.detalle || '';

        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(10);
        doc.text(`Máquina: ${machineLabel}`, 40, 60);
        doc.text(`Rango: ${startDate} - ${endDate}`, 40, 76);
        doc.text(`Resumen: ${summary}`, 40, 92);

        const headers = ['Fecha', 'Tipo', 'Horómetro', 'Detalle'];
        const tableRows = rows.slice(0, 40).map((row) => ([
          row.fecha_evento || '-',
          row.tipo_evento || '-',
          row.horometro ?? '-',
          row.detalle || '-'
        ]));

        let y = 120;
        doc.setFontSize(11);
        doc.text(headers.join(' | '), 40, y);
        y += 18;

        tableRows.forEach((row) => {
          const line = row.map((value) => String(value).slice(0, 30)).join(' | ');
          if (y > 520) {
            doc.addPage();
            y = 40;
          }
          doc.text(line, 40, y);
          y += 16;
        });

        doc.save(`reporte_maquina_${selectedIds[0] || 'sin_seleccion'}.pdf`);
        setReportStatus('PDF generado correctamente', 'success');
      });

      const printBtn = document.getElementById('reportPrintBtn');
      if (printBtn) {
        printBtn.addEventListener('click', async () => {
          let reportState = window.__srmmReporteState || {};
          let rows = Array.isArray(reportState.rows) ? reportState.rows : [];

          if (!rows.length) {
            const selectedIds = getSelectedReportMachineIds(machineSelect);
            if (!selectedIds.length) {
              setReportStatus('No hay datos para imprimir', 'error');
              return;
            }

            setReportStatus('Buscando datos en el servidor...', 'info');
            try {
              const d = getEffectiveReportDates();
              await loadSelectedMachinesReport(selectedIds, d.start, d.end);
              reportState = window.__srmmReporteState || {};
              rows = Array.isArray(reportState.rows) ? reportState.rows : [];
              if (!rows.length) {
                setReportStatus('No hay datos en el servidor para los filtros seleccionados', 'error');
                return;
              }
              setReportStatus('Datos cargados desde servidor', 'success');
            } catch (err) {
              console.error('Error fallback historial:', err);
              setReportStatus('Error obteniendo datos del servidor', 'error');
              return;
            }
          }

          const machineLabel = document.getElementById('reportSelectedMachineLabel')?.textContent || 'Sin máquina seleccionada';
          const d = getEffectiveReportDates();
          const startDate = d.start || '';
          const endDate = d.end || '';

          const win = window.open('', '_blank');
          if (!win) {
            setReportStatus('No se pudo abrir ventana de impresión', 'error');
            return;
          }

          const style = `
                    body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #191919; padding: 24px; }
                    .print-header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
                    .print-logo { width:72px; height:72px; object-fit:contain; }
                    .print-title { font-size:18px; font-weight:800; margin:0; }
                    .print-meta { color:#666; margin-top:6px; font-size:13px; }
                    h1 { font-size: 18px; margin-bottom: 6px; }
                    .meta { color: #666; margin-bottom: 18px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    th, td { border: 1px solid #eee; padding: 8px 10px; text-align: left; font-size: 12px; }
                    th { background: #f7f7f7; font-weight: 700; }
                    footer { margin-top:18px; color:#666; font-size:12px; }
                    .print-page { page-break-after: always; }
                    @media print {
                        button { display: none !important; }
                        a { color: inherit; text-decoration: none; }
                        header, footer { page-break-inside: avoid; }
                        table { page-break-inside: auto; }
                        tr    { page-break-inside: avoid; page-break-after: auto; }
                    }
                `;

          const userName = document.getElementById('sidebarName')?.textContent || '';
          const companyLogo = '/favicon.svg';
          const headerHtml = `
                    <div class="print-header">
                        <img src="${companyLogo}" class="print-logo" alt="Logo">
                        <div>
                            <div class="print-title">Historial de mantenciones</div>
                            <div class="print-meta">Máquina: ${escapeHtml(machineLabel)} · Rango: ${escapeHtml(startDate || '-') } — ${escapeHtml(endDate || '-')}</div>
                            <div class="print-meta">Generado: ${new Date().toLocaleString('es-CL')} · Usuario: ${escapeHtml(userName)}</div>
                        </div>
                    </div>
                `;

          const rowsPerPage = 25;
          const pages = [];
          for (let i = 0; i < rows.length; i += rowsPerPage) {
            pages.push(rows.slice(i, i + rowsPerPage));
          }

          const pagesHtml = pages.map((pageRows, pageIndex) => {
            const bodyRows = pageRows.map(r => `
                        <tr>
                            <td>${escapeHtml(r.fecha_evento || '-')}</td>
                            <td>${escapeHtml(r.tipo_evento || '-')}</td>
                            <td>${escapeHtml(r.horometro ?? '-')}</td>
                            <td>${escapeHtml(r.usuario_responsable || '-')}</td>
                            <td>${escapeHtml(r.detalle || '-')}</td>
                        </tr>
                    `).join('');

            const table = `
                        <table>
                            <thead>
                                <tr><th>Fecha</th><th>Tipo</th><th>Horómetro</th><th>Responsable</th><th>Detalle</th></tr>
                            </thead>
                            <tbody>${bodyRows}</tbody>
                        </table>`;

            const pageFooter = `<div style="margin-top:8px;font-size:12px;color:#666;">Página ${pageIndex + 1} / ${pages.length}</div>`;

            return `<div class="print-page">${headerHtml}${table}${pageFooter}</div>`;
          }).join('\n');

          win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Historial imprimible</title><style>${style}</style></head><body>${pagesHtml}<div style="margin-top:18px; display:flex; gap:8px;"><button onclick="window.print();">Imprimir</button><button onclick="window.close();">Cerrar</button></div></body></html>`);
          win.document.close();
          setReportStatus('Vista imprimible generada', 'success');
        });
      }

      if (fallasRefreshBtn) {
        fallasRefreshBtn.addEventListener('click', loadReportFallasDashboard);
      }

      if (fallasPrintBtn) {
        fallasPrintBtn.addEventListener('click', () => {
          if (!window.reportFallasState.rows || !window.reportFallasState.rows.length) {
            setReportStatus('No hay datos de fallas para imprimir', 'warning');
            return;
          }
          openReportFallasPrintWindow();
        });
      }

    }

    loadReportesDashboard();
  }

  window.ReportesDashboardModule = {
    getSelectedReportMachineIds,
    updateReportKpis,
    loadSelectedMachineReport,
    loadSelectedMachinesReport,
    loadReportesDashboard,
    getEffectiveReportDates,
    initReportesDashboard,
  };
})();